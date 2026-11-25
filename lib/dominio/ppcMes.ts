import { statusAtividade } from "./calculos";

/** PPC dia a dia (Análise) e farol (quadro e Análise). */

export type Farol = "verde" | "amarelo" | "vermelho";
export type DiaPpc = { data: string; concluidas: number; total: number; ppc: number | null };

export const LIMITE_VERDE = 0.8;
export const LIMITE_AMARELO = 0.6;

export function farol(ppc: number | null): Farol | null {
  if (ppc === null) return null;
  if (ppc >= LIMITE_VERDE) return "verde";
  return ppc >= LIMITE_AMARELO ? "amarelo" : "vermelho";
}

/**
 * Um item por data de `inicio` a `fim` (inclusive). `turnos`: fechados, já sem extra/adiantada
 * (como em listarTurnosFechadosParaAnalise). O PPC do dia junta os turnos do dia; dia sem turno fechado = null.
 */
export function ppcPorDia(
  turnos: { data: string; atividades: { qtd_planejada: number; qtd_realizada: number | null }[] }[],
  inicio: string,
  fim: string,
): { dias: DiaPpc[]; aderencia: { concluidas: number; total: number; ppc: number | null } } {
  const dias: DiaPpc[] = [];
  for (let d = new Date(`${inicio}T12:00:00Z`); d.toISOString().slice(0, 10) <= fim; d.setUTCDate(d.getUTCDate() + 1)) {
    dias.push({ data: d.toISOString().slice(0, 10), concluidas: 0, total: 0, ppc: null });
  }
  const porData = new Map(dias.map((d) => [d.data, d]));
  for (const t of turnos) {
    const d = porData.get(t.data);
    if (!d) continue;
    d.total += t.atividades.length;
    d.concluidas += t.atividades.filter((a) => statusAtividade(a.qtd_planejada, a.qtd_realizada) === "concluida").length;
  }
  for (const d of dias) d.ppc = d.total > 0 ? d.concluidas / d.total : null;
  const concluidas = dias.reduce((s, d) => s + d.concluidas, 0);
  const total = dias.reduce((s, d) => s + d.total, 0);
  return { dias, aderencia: { concluidas, total, ppc: total > 0 ? concluidas / total : null } };
}
