import { hhTurno, statusAtividade } from "./calculos";
import { compararTurnos } from "./regras";
import type { Causa, Periodo, StatusAtividade, StatusTurno } from "./tipos";

/** Quadro de check-in/check-out: puro, a partir de um único formato de entrada (também a foto do check-in). */

export type ResponsavelRef = { id: string; nome: string; ativo: boolean };
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
  }[];
  efetivo: { funcao: string; quantidade: number; responsavel_id: string | null }[];
};
export type Visao = "checkin" | "checkout";
export type ResumoEquipe = {
  concluidas: number;
  total: number;
  percentual: number | null;
  extras: number;
  base: "programadas" | "todas";
  pessoas: number;
  hh: number | null;
};
export type FaixaQuadro = {
  /** null = "Sem responsável". */
  responsavel: ResponsavelRef | null;
  atividades: (EntradaQuadro["atividades"][number] & { situacao: StatusAtividade })[];
  efetivo: { funcao: string; quantidade: number }[];
  resumo: ResumoEquipe;
};
export type ModeloQuadro = { entrada: EntradaQuadro; faixas: FaixaQuadro[] };
export type TurnoRef = { id: string; data: string; periodo: Periodo; status: StatusTurno };

export function resumoEquipe(
  faixa: Pick<FaixaQuadro, "atividades" | "efetivo">,
  turno: EntradaQuadro["turno"],
  temProgramadaNoTurno: boolean,
): ResumoEquipe {
  const base = temProgramadaNoTurno ? "programadas" : "todas";
  const contadas = temProgramadaNoTurno ? faixa.atividades.filter((a) => a.programada) : faixa.atividades;
  const concluidas = contadas.filter((a) => statusAtividade(a.qtd_planejada, a.qtd_realizada) === "concluida").length;
  const hh = hhTurno(
    faixa.efetivo,
    { inicio: turno.hora_inicio_prevista, fim: turno.hora_fim_prevista },
    { inicio: turno.hora_inicio_real, fim: turno.hora_fim_real },
  );
  return {
    concluidas,
    total: contadas.length,
    percentual: contadas.length === 0 ? null : concluidas / contadas.length,
    extras: temProgramadaNoTurno ? faixa.atividades.length - contadas.length : 0,
    base,
    pessoas: faixa.efetivo.reduce((s, e) => s + e.quantidade, 0),
    hh: hh === null ? null : Math.round(hh * 10) / 10,
  };
}

export function montarQuadro(e: EntradaQuadro): ModeloQuadro {
  const temProgramada = e.atividades.some((a) => a.programada);
  const porId = new Map(e.responsaveis.map((r) => [r.id, r]));
  const chaves = new Set<string | null>([
    ...e.atividades.map((a) => a.responsavel_id),
    ...e.efetivo.map((x) => x.responsavel_id),
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
    return { responsavel, atividades, efetivo, resumo: resumoEquipe({ atividades, efetivo }, e.turno, temProgramada) };
  });
  return { entrada: e, faixas };
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

export function resolverEscolhaCampo(
  r: unknown,
  idsDoTurno: string[],
): { modo: "escolher" } | { modo: "todos" } | { modo: "responsavel"; id: string } {
  if (idsDoTurno.length === 0) return { modo: "todos" };
  if (r === "todos") return { modo: "todos" };
  if (typeof r === "string" && idsDoTurno.includes(r)) return { modo: "responsavel", id: r };
  return { modo: "escolher" };
}

export function contarSemResponsavel(atividades: { responsavel_id: string | null }[]): number {
  return atividades.filter((a) => a.responsavel_id === null).length;
}

export function textoSemResponsavel(n: number): string | null {
  if (n <= 0) return null;
  return n === 1 ? "1 atividade sem responsável" : `${n} atividades sem responsável`;
}
