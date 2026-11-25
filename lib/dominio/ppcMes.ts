import { statusAtividade } from "./calculos";

/** Item 2.4: PPC dia a dia do mês, aderência acumulada e farol. */

export type Farol = "verde" | "amarelo" | "vermelho";
export type DiaPpc = { data: string; concluidas: number; total: number; ppc: number | null };
export type PpcMes = { mes: string; dias: DiaPpc[]; aderencia: { concluidas: number; total: number; ppc: number | null } };

export const LIMITE_VERDE = 0.8;
export const LIMITE_AMARELO = 0.6;

export function farol(ppc: number | null): Farol | null {
  if (ppc === null) return null;
  if (ppc >= LIMITE_VERDE) return "verde";
  return ppc >= LIMITE_AMARELO ? "amarelo" : "vermelho";
}

const diasNoMes = (mes: string) => new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate();

/**
 * `turnos`: fechados, já sem extra/adiantada (como em listarTurnosFechadosParaAnalise).
 * O PPC do dia junta todos os turnos fechados do dia; dia sem turno fechado = null.
 */
export function ppcDoMes(
  turnos: { data: string; atividades: { qtd_planejada: number; qtd_realizada: number | null }[] }[],
  mes: string,
): PpcMes {
  const dias: DiaPpc[] = Array.from({ length: diasNoMes(mes) }, (_, i) => ({
    data: `${mes}-${String(i + 1).padStart(2, "0")}`,
    concluidas: 0,
    total: 0,
    ppc: null,
  }));
  for (const t of turnos) {
    if (t.data.slice(0, 7) !== mes) continue;
    const d = dias[Number(t.data.slice(8, 10)) - 1];
    d.total += t.atividades.length;
    d.concluidas += t.atividades.filter((a) => statusAtividade(a.qtd_planejada, a.qtd_realizada) === "concluida").length;
  }
  for (const d of dias) d.ppc = d.total > 0 ? d.concluidas / d.total : null;
  const concluidas = dias.reduce((s, d) => s + d.concluidas, 0);
  const total = dias.reduce((s, d) => s + d.total, 0);
  return { mes, dias, aderencia: { concluidas, total, ppc: total > 0 ? concluidas / total : null } };
}
