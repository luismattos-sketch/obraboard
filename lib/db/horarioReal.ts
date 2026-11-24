import "server-only";
import { horarioRealDasEquipes } from "@/lib/dominio/efetivoHH";
import type { criarClienteAdmin } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof criarClienteAdmin>;

/**
 * Recalcula o horário real do turno a partir dos toques das equipes (Iniciar / Terminei).
 * Só roda nas ações do campo: correção do planejador vale até o próximo toque. Falha só loga (o toque vale).
 */
export async function sincronizarHorarioReal(admin: Admin, turnoId: string): Promise<void> {
  const [{ data: ats, error: ea }, { data: ini, error: ei }, { data: fim, error: ef }] = await Promise.all([
    admin.from("atividades").select("responsavel_id").eq("turno_id", turnoId),
    admin.from("turno_equipes_iniciadas").select("iniciou_em, created_at").eq("turno_id", turnoId),
    admin.from("turno_equipes_terminadas").select("responsavel_id, terminou_em, created_at").eq("turno_id", turnoId),
  ]);
  if (ea || ei || ef) {
    console.error("sincronizarHorarioReal:", (ea ?? ei ?? ef)!.message);
    return;
  }
  const equipes = [...new Set((ats ?? []).map((a) => a.responsavel_id as string | null).filter((x): x is string => x !== null))];
  const h = horarioRealDasEquipes({
    iniciados: (ini ?? []) as { iniciou_em: string; created_at: string }[],
    terminados: (fim ?? []) as { responsavel_id: string; terminou_em: string; created_at: string }[],
    equipes,
  });
  const { error } = await admin.from("turnos").update(h).eq("id", turnoId);
  if (error) console.error("sincronizarHorarioReal (gravar):", error.message);
}
