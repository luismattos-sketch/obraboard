import { minutos, statusAtividade } from "./calculos";
import {
  calcularHH,
  descreverOcorrencia,
  horaCurta,
  intervaloDoTurno,
  janelaDoTurno,
  nomeDaEquipe,
  paradasAbertas,
  type HHEquipe,
  type Iniciado,
  type Ocorrencia,
  type Recebido,
  type Terminado,
} from "./efetivoHH";
import { compararTurnos } from "./regras";
import type { Causa, Periodo, StatusAtividade, StatusTurno, TipoAtividade } from "./tipos";

/** Quadro de check-in/check-out: puro, a partir de um único formato de entrada (também a foto do check-in). */

export type ResponsavelRef = { id: string; nome: string; ativo: boolean; especialidade?: string | null };
export type EntradaQuadro = {
  obra: { id: string; nome: string };
  turno: {
    id: string;
    data: string;
    periodo: Periodo;
    status: StatusTurno;
    hora_inicio_prevista: string | null;
    hora_fim_prevista: string | null;
    hora_inicio_real: string | null;
    hora_fim_real: string | null;
    /** Ausentes na foto do check-in antiga (= sem intervalo). */
    intervalo_inicio?: string | null;
    intervalo_fim?: string | null;
  };
  responsaveis: ResponsavelRef[];
  atividades: {
    id: string;
    ordem: number;
    descricao: string;
    local: string | null;
    unidade: string | null;
    qtd_planejada: number;
    qtd_realizada: number | null;
    causa: Causa | null;
    programada: boolean;
    responsavel_id: string | null;
    /** Ausente em fotos antigas (= regra antiga: programadas contam, avulsas são extra). */
    tipo?: TipoAtividade | null;
    /** Equipe prevista; ausente em fotos antigas. */
    equipe?: { funcao: string; quantidade: number }[];
  }[];
  efetivo: { funcao: string; quantidade: number; responsavel_id: string | null }[];
  /** Ausente na foto do check-in antiga (= nenhuma). */
  ocorrencias?: Ocorrencia[];
  /** Equipes que tocaram "Terminei minha parte" (ausente = nenhuma). */
  terminados?: Terminado[];
  /** Equipes que tocaram "Iniciar turno" (ausente = nenhuma; fotos antigas não têm). */
  iniciados?: Iniciado[];
};
export type Visao = "checkin" | "checkout";
export type ResumoEquipe = {
  concluidas: number;
  total: number;
  percentual: number | null;
  extras: number;
  adiantadas: number;
  base: "programadas" | "todas";
  pessoas: number;
  /** HH total da equipe (produtivo + parado), 1 casa. */
  hh: number | null;
  hhParado: number | null;
  /** Pessoas emprestadas por outras equipes (não entram em `pessoas`). */
  recebidos: Recebido[];
  avisos: string[];
  /** "HH:MM" em que a equipe avisou que terminou. */
  terminouEm: string | null;
  /** "HH:MM" em que a equipe tocou "Iniciar turno". */
  iniciouEm: string | null;
};
export type FaixaQuadro = {
  /** null = "Sem responsável". */
  responsavel: ResponsavelRef | null;
  atividades: (EntradaQuadro["atividades"][number] & { situacao: StatusAtividade })[];
  efetivo: { funcao: string; quantidade: number }[];
  resumo: ResumoEquipe;
};
/** Parada em aberto (faixa vermelha do topo). `duracaoMin` só quando há "agora". */
export type ParadaQuadro = { equipe: string; texto: string; desde: string; duracaoMin: number | null };
export type ModeloQuadro = { entrada: EntradaQuadro; faixas: FaixaQuadro[]; paradas: ParadaQuadro[] };
export type TurnoRef = { id: string; data: string; periodo: Periodo; status: StatusTurno };

export function resumoEquipe(
  faixa: Pick<FaixaQuadro, "atividades" | "efetivo">,
  turno: EntradaQuadro["turno"],
  temProgramadaNoTurno: boolean,
  /** HH já calculado com as ocorrências do turno; ausente = só o efetivo da faixa. */
  hhEquipe?: HHEquipe,
): ResumoEquipe {
  const comMarca = faixa.atividades.some((a) => a.tipo !== undefined);
  const contadas = comMarca
    ? faixa.atividades.filter((a) => !a.tipo)
    : temProgramadaNoTurno
      ? faixa.atividades.filter((a) => a.programada)
      : faixa.atividades;
  const base = temProgramadaNoTurno && contadas.every((a) => a.programada) ? "programadas" : "todas";
  const concluidas = contadas.filter((a) => statusAtividade(a.qtd_planejada, a.qtd_realizada) === "concluida").length;
  const h =
    hhEquipe ??
    calcularHH({
      efetivo: faixa.efetivo.map((x) => ({ ...x, responsavel_id: null })),
      ocorrencias: [],
      janela: janelaDoTurno(turno),
      intervalo: intervaloDoTurno(turno),
    }).equipes[0];
  const umaCasa = (n: number | null | undefined) => (n === null || n === undefined ? null : Math.round(n * 10) / 10);
  const total = h && h.hhProdutivo !== null && h.hhParado !== null ? h.hhProdutivo + h.hhParado : null;
  return {
    concluidas,
    total: contadas.length,
    percentual: contadas.length === 0 ? null : concluidas / contadas.length,
    extras: comMarca
      ? faixa.atividades.filter((a) => a.tipo === "extra").length
      : temProgramadaNoTurno
        ? faixa.atividades.length - contadas.length
        : 0,
    adiantadas: faixa.atividades.filter((a) => a.tipo === "adiantada").length,
    base,
    pessoas: faixa.efetivo.reduce((s, e) => s + e.quantidade, 0),
    hh: total === null || (total === 0 && !h?.recebidos.length && faixa.efetivo.length === 0) ? null : umaCasa(total),
    hhParado: total === null ? null : umaCasa(h?.hhParado),
    recebidos: h?.recebidos ?? [],
    avisos: h?.avisos ?? [],
    terminouEm: null,
    iniciouEm: null,
  };
}

/** `agora` ("HH:MM"): paradas abertas contam até agora (quadro ao vivo). Ausente = até o fim do turno. */
export function montarQuadro(e: EntradaQuadro, agora?: string): ModeloQuadro {
  const temProgramada = e.atividades.some((a) => a.programada);
  const porId = new Map(e.responsaveis.map((r) => [r.id, r]));
  const hh = calcularHH({
    efetivo: e.efetivo,
    ocorrencias: e.ocorrencias ?? [],
    janela: janelaDoTurno(e.turno),
    intervalo: intervaloDoTurno(e.turno),
    agora,
  });
  const chaves = new Set<string | null>([
    ...e.atividades.map((a) => a.responsavel_id),
    ...e.efetivo.map((x) => x.responsavel_id),
    ...hh.equipes.filter((x) => x.recebidos.length > 0).map((x) => x.responsavel_id),
  ]);
  const nomeados = [...chaves]
    .filter((k): k is string => k !== null)
    .map((id) => porId.get(id) ?? { id, nome: "—", ativo: false })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const ordem: (ResponsavelRef | null)[] = [...nomeados, ...(chaves.has(null) ? [null] : [])];

  const faixas = ordem.map((responsavel) => {
    const id = responsavel?.id ?? null;
    const atividades = e.atividades
      .filter((a) => a.responsavel_id === id)
      .sort((x, y) => x.ordem - y.ordem)
      .map((a) => ({ ...a, situacao: statusAtividade(a.qtd_planejada, a.qtd_realizada) }));
    const efetivo = e.efetivo
      .filter((x) => x.responsavel_id === id)
      .map(({ funcao, quantidade }) => ({ funcao, quantidade }));
    const hhEquipe = hh.equipes.find((x) => x.responsavel_id === id);
    const resumo = resumoEquipe({ atividades, efetivo }, e.turno, temProgramada, hhEquipe);
    const t = (e.terminados ?? []).find((x) => x.responsavel_id === id);
    const i = (e.iniciados ?? []).find((x) => x.responsavel_id === id);
    return {
      responsavel,
      atividades,
      efetivo,
      resumo: { ...resumo, terminouEm: t ? horaCurta(t.terminou_em) : null, iniciouEm: i ? horaCurta(i.iniciou_em) : null },
    };
  });
  const nome = nomeDaEquipe(e.responsaveis);
  const ag = agora ? minutos(agora) : null;
  const paradas = paradasAbertas(e.ocorrencias ?? []).map((o) => {
    const ini = minutos(horaCurta(o.hora_inicio));
    return {
      equipe: nome(o.responsavel_id),
      texto: `${o.quantidade} ${o.funcao} ${descreverOcorrencia(o, nome).replace(/^\d+ /, "")}`,
      desde: horaCurta(o.hora_inicio),
      duracaoMin: ag !== null && ini !== null ? duracaoAte(ini, ag) : null,
    };
  });
  return { entrada: e, faixas, paradas };
}

const DIA_FECHADO = (t: TurnoRef) => t.status === "fechado";

export function escolherTurno(turnos: TurnoRef[], hoje: string): { turno: TurnoRef | null; foraDeHoje: boolean } {
  const deHoje = turnos.filter((t) => t.data === hoje).sort(compararTurnos);
  if (deHoje.length > 0) {
    const aberto = deHoje.find((t) => !DIA_FECHADO(t));
    return { turno: aberto ?? deHoje[deHoje.length - 1], foraDeHoje: false };
  }
  if (turnos.length === 0) return { turno: null, foraDeHoje: false };
  const ordenados = [...turnos].sort(compararTurnos);
  return { turno: ordenados[ordenados.length - 1], foraDeHoje: true };
}

export function vizinhos(turnos: TurnoRef[], id: string): { anterior: string | null; seguinte: string | null } {
  const ordenados = [...turnos].sort(compararTurnos);
  const i = ordenados.findIndex((t) => t.id === id);
  if (i < 0) return { anterior: null, seguinte: null };
  return { anterior: ordenados[i - 1]?.id ?? null, seguinte: ordenados[i + 1]?.id ?? null };
}

export function visaoPadrao(status: StatusTurno): Visao {
  return status === "planejado" ? "checkin" : "checkout";
}

export function visaoValida(pedida: unknown, status: StatusTurno): Visao {
  if (status === "planejado") return "checkin";
  return pedida === "checkin" || pedida === "checkout" ? pedida : visaoPadrao(status);
}

/** Cookie (no caminho do link) com o responsável que confirmou "Sou eu". */
export const COOKIE_RESPONSAVEL = "frentia_responsavel";

export function resolverEscolhaCampo(
  r: unknown,
  idsDoTurno: string[],
): { modo: "escolher" } | { modo: "todos" } | { modo: "responsavel"; id: string } {
  if (idsDoTurno.length === 0) return { modo: "todos" };
  if (r === "todos") return { modo: "todos" };
  if (typeof r === "string" && idsDoTurno.includes(r)) return { modo: "responsavel", id: r };
  return { modo: "escolher" };
}

/** Turno do fluxo antigo: nenhuma atividade tem responsável (campo edita e envia; mesma regra do servidor). */
export function campoSemResponsaveis(atividades: { responsavel_id: string | null }[]): boolean {
  return atividades.every((a) => a.responsavel_id === null);
}

export function contarSemResponsavel(atividades: { responsavel_id: string | null }[]): number {
  return atividades.filter((a) => a.responsavel_id === null).length;
}

export function textoSemResponsavel(n: number): string | null {
  if (n <= 0) return null;
  return n === 1 ? "1 atividade sem responsável" : `${n} atividades sem responsável`;
}

/** Ordena como as faixas do quadro: responsáveis em ordem alfabética, "Sem responsável" por último; `ordem` dentro do grupo. */
export function ordenarPorResponsavel<T extends { ordem: number; responsavel_id: string | null }>(
  itens: T[],
  responsaveis: Pick<ResponsavelRef, "id" | "nome">[],
): T[] {
  const nome = (id: string | null) => (id === null ? null : (responsaveis.find((r) => r.id === id)?.nome ?? "—"));
  return [...itens].sort((x, y) => {
    const nx = nome(x.responsavel_id);
    const ny = nome(y.responsavel_id);
    if (nx !== ny) {
      if (nx === null) return 1;
      if (ny === null) return -1;
      return nx.localeCompare(ny, "pt-BR") || (x.responsavel_id ?? "").localeCompare(y.responsavel_id ?? "");
    }
    return x.ordem - y.ordem;
  });
}

/** Minutos de `ini` até `ag` (atravessa a meia-noite); início "no futuro" (relógio adiantado) = 0. */
function duracaoAte(ini: number, ag: number): number {
  const d = (ag - ini + 1440) % 1440;
  return d > 720 ? 0 : d;
}
