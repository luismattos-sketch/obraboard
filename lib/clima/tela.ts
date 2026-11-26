import type { TurnoCompleto } from "@/lib/db/turnos";
import { obterClimaTurno } from "./obter";
import type { ClimaTurno } from "./tipos";

export type ClimaNaTela = { clima: ClimaTurno | null; aviso: "sem_cidade" | "indisponivel" | null; parcial: boolean; previsao: boolean };

type TurnoClima = Pick<TurnoCompleto, "status" | "clima_turno" | "data" | "hora_inicio_real" | "hora_fim_real" | "hora_inicio_prevista" | "hora_fim_prevista"> & {
  obra: { latitude?: number | null; longitude?: number | null };
};

/**
 * O que mostrar no bloco de clima: o gravado; em campo, a consulta ao vivo (com cache de 30 min);
 * com `previsao`, o turno planejado mostra a previsão da janela inteira.
 */
export async function climaParaTela(turno: TurnoClima, opcoes: { previsao?: boolean } = {}): Promise<ClimaNaTela> {
  if (turno.clima_turno) return { clima: turno.clima_turno, aviso: null, parcial: false, previsao: false };
  const semCidade = turno.obra.latitude == null || turno.obra.longitude == null;
  if (semCidade) return { clima: null, aviso: "sem_cidade", parcial: false, previsao: false };
  if (turno.status === "planejado" && opcoes.previsao) {
    const clima = await obterClimaTurno(turno.obra, turno, { revalidar: 1800, previsao: true }).catch(() => null);
    return { clima, aviso: clima ? null : "indisponivel", parcial: false, previsao: true };
  }
  if (turno.status !== "em_campo") return { clima: null, aviso: "indisponivel", parcial: false, previsao: false };
  const clima = await obterClimaTurno(turno.obra, turno, { revalidar: 1800 }).catch(() => null);
  if (!clima && opcoes.previsao) {
    // Liberado antes do horário (sem leituras ainda): no quadro, mostra a previsão.
    const prev = await obterClimaTurno(turno.obra, turno, { revalidar: 1800, previsao: true }).catch(() => null);
    if (prev) return { clima: prev, aviso: null, parcial: false, previsao: true };
  }
  return { clima, aviso: clima ? null : "indisponivel", parcial: true, previsao: false };
}
