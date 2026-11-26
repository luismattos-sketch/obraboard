import type { SupabaseClient } from "@supabase/supabase-js";
import { obterClimaTurno } from "@/lib/clima/obter";
import type { ClimaTurno, HoraClima } from "@/lib/clima/tipos";
import type { TurnoCompleto } from "./turnos";

/** Lê o clima do turno vindo do banco ou da foto do RDO (objeto, lista de 1 ou nulo). */
export function lerClimaTurno(v: unknown): ClimaTurno | null {
  const r = (Array.isArray(v) ? v[0] : v) as Record<string, unknown> | null | undefined;
  if (!r || !Array.isArray(r.leituras)) return null;
  return {
    temp_media: Number(r.temp_media),
    temp_max: Number(r.temp_max),
    temp_min: Number(r.temp_min),
    chuva_mm: Number(r.chuva_mm),
    choveu: Boolean(r.choveu),
    leituras: (r.leituras as HoraClima[]).map((l) => ({
      hora: String(l.hora), temperatura: Number(l.temperatura), chuva_mm: Number(l.chuva_mm), codigo: Number(l.codigo),
    })),
  };
}

/** Busca e grava o clima do turno. Sem resultado não apaga o que existe. Nunca lança. */
export async function gravarClimaTurno(c: SupabaseClient, turno: TurnoCompleto): Promise<boolean> {
  try {
    const clima = await obterClimaTurno(turno.obra, turno);
    if (!clima) return false;
    const { error } = await c.from("clima_turno").upsert({ turno_id: turno.id, ...clima, buscado_em: new Date().toISOString() });
    if (error) {
      console.error("gravarClimaTurno:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("gravarClimaTurno:", e);
    return false;
  }
}
