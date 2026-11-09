import type { AtividadeExec, StatusAtividade } from "./tipos";

export function statusAtividade(
  qtd_planejada: number,
  qtd_realizada: number | null,
): StatusAtividade {
  if (qtd_realizada === null || qtd_realizada <= 0) return "nao_iniciada";
  return qtd_realizada >= qtd_planejada ? "concluida" : "parcial";
}

/** Fração (0..1) de atividades concluídas; null sem atividades. */
export function percentualCumprimento(
  atividades: Pick<AtividadeExec, "qtd_planejada" | "qtd_realizada">[],
): number | null {
  if (atividades.length === 0) return null;
  const concluidas = atividades.filter(
    (a) => statusAtividade(a.qtd_planejada, a.qtd_realizada) === "concluida",
  ).length;
  return concluidas / atividades.length;
}

function minutos(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function horasEntre(inicio: string | null, fim: string | null): number | null {
  if (!inicio || !fim) return null;
  const i = minutos(inicio);
  const f = minutos(fim);
  if (i === null || f === null) return null;
  const diff = f >= i ? f - i : f + 24 * 60 - i;
  return diff / 60;
}

type Janela = { inicio: string | null; fim: string | null };

export function hhTurno(
  efetivo: { quantidade: number }[],
  previsto: Janela,
  real: Janela,
): number | null {
  const horas =
    real.inicio && real.fim
      ? horasEntre(real.inicio, real.fim)
      : horasEntre(previsto.inicio, previsto.fim);
  if (horas === null) return null;
  const pessoas = efetivo.reduce((soma, e) => soma + e.quantidade, 0);
  if (pessoas === 0) return null;
  return pessoas * horas;
}

export function saldoPendente(qtd_planejada: number, qtd_realizada: number | null): number {
  return Math.max(0, qtd_planejada - (qtd_realizada ?? 0));
}
