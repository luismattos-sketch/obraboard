import { statusAtividade } from "./calculos";
import { calcularHH, intervaloDoTurno, janelaDoTurno } from "./efetivoHH";
import { hhDoExtra, type Material } from "./extraApontamento";
import { hhPerdidoDaObra, type CausaHH, type GrupoHH, type TurnoHH } from "./hhPerdido";
import { CAUSAS, GRUPO_CAUSA, type Causa, type Periodo, type TipoAtividade } from "./tipos";

/**
 * Item 4.4: Relatório da Obra (semana, mês ou obra inteira) a partir dos turnos fechados do período.
 * Texto descritivo e neutro: registra o que aconteceu, com a origem de cada número.
 */

export type AtividadeRelatorio = {
  id: string;
  descricao: string;
  local: string | null;
  unidade: string;
  qtd_planejada: number;
  qtd_realizada: number | null;
  tipo: TipoAtividade | null;
  responsavel_id: string | null;
  solicitado_por: string | null;
  extra_pessoas: number | null;
  extra_horas: number | null;
  materiais: Material[];
  foto_path: string | null;
  ciencia: { nome: string; ciente_em: string } | null;
};

export type TurnoRelatorio = TurnoHH & { atividades: AtividadeRelatorio[] };

export type LinhaTempo = {
  data: string;
  periodo: Periodo;
  concluidas: number;
  total: number;
  cumprimento: number | null;
  hh: number | null;
  hhParado: number;
  paradas: number;
  extras: number;
};

export type ParadaRelatorio = {
  data: string;
  periodo: Periodo;
  equipe: string;
  pessoas: number;
  funcao: string;
  inicio: string;
  fim: string | null;
  causa: string;
  grupo: GrupoHH;
  observacao: string | null;
  foto_path: string | null;
};

export type ExtraRelatorio = {
  data: string;
  periodo: Periodo;
  descricao: string;
  local: string | null;
  qtd: number;
  unidade: string;
  equipe: string | null;
  solicitado_por: string | null;
  extra_pessoas: number | null;
  extra_horas: number | null;
  hh: number | null;
  materiais: Material[];
  foto_path: string | null;
  ciencia: { nome: string; ciente_em: string } | null;
};

export type RelatorioObra = {
  turnos: number;
  concluidas: number;
  total: number;
  cumprimento: number | null;
  hh: number | null;
  hhParado: number;
  grupos: { grupo: GrupoHH; hh: number; fracao: number }[];
  hhPorCausa: CausaHH[];
  hhExtra: number;
  extrasComCiencia: number;
  linhaDoTempo: LinhaTempo[];
  paradas: ParadaRelatorio[];
  extras: ExtraRelatorio[];
};

const ORDEM_GRUPO: Record<GrupoHH, number> = { externa: 0, interna: 1, outra: 2 };
const r2 = (n: number) => Math.round(n * 100) / 100;

export function montarRelatorio(turnosEntrada: TurnoRelatorio[], responsaveis: { id: string; nome: string }[]): RelatorioObra {
  const nomes = new Map(responsaveis.map((r) => [r.id, r.nome]));
  const nome = (id: string | null) => (id ? (nomes.get(id) ?? "Sem equipe") : "Sem equipe");
  const turnos = [...turnosEntrada].sort((a, b) => a.data.localeCompare(b.data) || a.periodo.localeCompare(b.periodo));

  const linhaDoTempo: LinhaTempo[] = [];
  const paradas: ParadaRelatorio[] = [];
  const extras: ExtraRelatorio[] = [];
  let hhTotal = 0;
  let temHH = false;

  for (const t of turnos) {
    const r = calcularHH({
      efetivo: t.efetivo,
      ocorrencias: t.ocorrencias,
      janela: janelaDoTurno(t),
      intervalo: intervaloDoTurno(t),
      iniciados: t.iniciados,
      terminados: t.terminados,
    });
    if (r.hh !== null) {
      hhTotal += r.hh;
      temHH = true;
    }
    const doDia = t.atividades.filter((a) => !a.tipo);
    const concluidas = doDia.filter((a) => statusAtividade(a.qtd_planejada, a.qtd_realizada) === "concluida").length;
    const paradasDoTurno = t.ocorrencias.filter((o) => o.tipo === "parado");
    const extrasDoTurno = t.atividades.filter((a) => a.tipo === "extra");
    linhaDoTempo.push({
      data: t.data,
      periodo: t.periodo,
      concluidas,
      total: doDia.length,
      cumprimento: doDia.length ? concluidas / doDia.length : null,
      hh: r.hh,
      hhParado: r.hhParado ?? 0,
      paradas: paradasDoTurno.length,
      extras: extrasDoTurno.length,
    });
    for (const o of paradasDoTurno) {
      const causa = (o.causa ?? "outro") as Causa;
      paradas.push({
        data: t.data,
        periodo: t.periodo,
        equipe: nome(o.responsavel_id),
        pessoas: o.quantidade,
        funcao: o.funcao,
        inicio: o.hora_inicio.slice(0, 5),
        fim: o.hora_fim ? o.hora_fim.slice(0, 5) : null,
        causa: CAUSAS[causa],
        grupo: GRUPO_CAUSA[causa] ?? "outra",
        observacao: o.observacao ?? null,
        foto_path: o.foto_path ?? null,
      });
    }
    for (const a of extrasDoTurno) {
      extras.push({
        data: t.data,
        periodo: t.periodo,
        descricao: a.descricao,
        local: a.local,
        qtd: a.qtd_realizada ?? a.qtd_planejada,
        unidade: a.unidade,
        equipe: a.responsavel_id ? nome(a.responsavel_id) : null,
        solicitado_por: a.solicitado_por,
        extra_pessoas: a.extra_pessoas,
        extra_horas: a.extra_horas,
        hh: hhDoExtra(a),
        materiais: a.materiais,
        foto_path: a.foto_path,
        ciencia: a.ciencia,
      });
    }
  }

  paradas.sort((a, b) => ORDEM_GRUPO[a.grupo] - ORDEM_GRUPO[b.grupo] || a.data.localeCompare(b.data) || a.inicio.localeCompare(b.inicio));
  const perdido = hhPerdidoDaObra(turnos, responsaveis);
  const concluidas = linhaDoTempo.reduce((s, l) => s + l.concluidas, 0);
  const total = linhaDoTempo.reduce((s, l) => s + l.total, 0);

  return {
    turnos: turnos.length,
    concluidas,
    total,
    cumprimento: total ? concluidas / total : null,
    hh: temHH ? r2(hhTotal) : null,
    hhParado: r2(perdido.total),
    grupos: perdido.grupos,
    hhPorCausa: perdido.causas,
    hhExtra: r2(extras.reduce((s, e) => s + (e.hh ?? 0), 0)),
    extrasComCiencia: extras.filter((e) => e.ciencia).length,
    linhaDoTempo,
    paradas,
    extras,
  };
}

/** Período do relatório: "semana" (segunda a domingo), "mes" (AAAA-MM) ou "obra" (início até hoje). */
export function periodoDoRelatorio(
  tipo: string | null,
  valor: string | null,
  hoje: string,
  inicioObra: string,
): { de: string; ate: string; rotulo: string } | null {
  const dataOk = (d: string | null): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T12:00:00Z`));
  const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
  const somar = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  if (tipo === "semana" && dataOk(valor)) {
    const dow = (new Date(`${valor}T12:00:00Z`).getUTCDay() + 6) % 7;
    const de = somar(valor, -dow);
    const ate = somar(de, 6);
    return { de, ate, rotulo: `Semana de ${fmt(de)} a ${fmt(ate)}` };
  }
  if (tipo === "mes" && valor && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor)) {
    const de = `${valor}-01`;
    const [a, m] = valor.split("-").map(Number);
    const ate = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
    const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    return { de, ate, rotulo: `Mês de ${MESES[m - 1]} de ${a}` };
  }
  if (tipo === "obra") {
    const de = inicioObra <= hoje ? inicioObra : hoje;
    return { de, ate: hoje, rotulo: `Obra inteira, de ${fmt(de)} a ${fmt(hoje)}` };
  }
  return null;
}
