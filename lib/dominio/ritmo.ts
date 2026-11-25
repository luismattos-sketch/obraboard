import { avancoFisico, contaNoDia, minutos, statusAtividade } from "./calculos";
import type { StatusTurno, TipoAtividade } from "./tipos";

/** Resumo do turno no quadro: "vamos fechar o dia?" (anel de cumprimento + ritmo tempo × avanço). */

export const FOLGA_RITMO = 0.15;

export type ResumoTurno = {
  concluidas: number;
  andamento: number;
  naoIniciadas: number;
  total: number;
  cumprimento: number | null;
  avanco: number | null;
  tempo: number | null;
  ritmo: "abaixo" | "no_ritmo" | null;
  fechado: boolean;
};

type Atv = { qtd_planejada: number; qtd_realizada: number | null; tipo?: TipoAtividade | null };

/** Fração (0..1) da janela prevista já passada; null sem horário ou sem "agora". Atravessa a meia-noite. */
function fracaoTempo(inicio: string | null, fim: string | null, agora: string | undefined): number | null {
  const i = inicio ? minutos(inicio) : null;
  let f = fim ? minutos(fim) : null;
  let a = agora ? minutos(agora) : null;
  if (i === null || f === null || a === null) return null;
  if (f <= i) {
    f += 1440;
    // Antes do início: à tarde é o mesmo dia (ainda não começou); de manhã é a madrugada seguinte (como agoraDoTurno).
    if (a < i) a = a >= 720 ? i : a + 1440;
  }
  return Math.min(1, Math.max(0, (a - i) / (f - i)));
}

export function resumoDoTurno(
  turno: { status: StatusTurno; hora_inicio_prevista: string | null; hora_fim_prevista: string | null },
  todas: Atv[],
  agora?: string,
): ResumoTurno {
  const atividades = todas.filter(contaNoDia);
  const status = atividades.map((x) => statusAtividade(x.qtd_planejada, x.qtd_realizada));
  const total = atividades.length;
  const concluidas = status.filter((s) => s === "concluida").length;
  const andamento = status.filter((s) => s === "parcial").length;
  const fechado = turno.status === "fechado";
  const avanco = avancoFisico(atividades);
  const tempo = fechado ? null : fracaoTempo(turno.hora_inicio_prevista, turno.hora_fim_prevista, agora);
  return {
    concluidas,
    andamento,
    naoIniciadas: total - concluidas - andamento,
    total,
    cumprimento: total === 0 ? null : concluidas / total,
    avanco,
    tempo,
    ritmo: avanco === null || tempo === null ? null : avanco < tempo - FOLGA_RITMO ? "abaixo" : "no_ritmo",
    fechado,
  };
}

export function aderencia(turnos: { atividades: { qtd_planejada: number; qtd_realizada: number | null }[] }[]) {
  let concluidas = 0;
  let total = 0;
  for (const t of turnos) {
    total += t.atividades.length;
    concluidas += t.atividades.filter((x) => statusAtividade(x.qtd_planejada, x.qtd_realizada) === "concluida").length;
  }
  return { concluidas, total, ppc: total > 0 ? concluidas / total : null };
}
