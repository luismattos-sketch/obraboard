import type { TurnoCompleto } from "@/lib/db/turnos";
import { obterClimaTurno } from "./obter";
import type { ClimaTurno } from "./tipos";

export type ClimaNaTela = { clima: ClimaTurno | null; aviso: "sem_cidade" | "indisponivel" | null; parcial: boolean };

/** O que mostrar no bloco de clima: o gravado; em campo, a consulta ao vivo (com cache de 30 min). */
export async function climaParaTela(turno: Pick<TurnoCompleto, "status" | "obra" | "clima_turno" | "data" | "hora_inicio_real" | "hora_fim_real" | "hora_inicio_prevista" | "hora_fim_prevista">): Promise<ClimaNaTela> {
  if (turno.clima_turno) return { clima: turno.clima_turno, aviso: null, parcial: false };
  const semCidade = turno.obra.latitude == null || turno.obra.longitude == null;
  if (semCidade) return { clima: null, aviso: "sem_cidade", parcial: false };
  if (turno.status !== "em_campo") return { clima: null, aviso: "indisponivel", parcial: false };
  const clima = await obterClimaTurno(turno.obra, turno, { revalidar: 1800 }).catch(() => null);
  return { clima, aviso: clima ? null : "indisponivel", parcial: true };
}
