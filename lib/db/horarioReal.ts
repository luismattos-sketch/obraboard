import "server-only";
import { horarioRealDasEquipes } from "@/lib/dominio/efetivoHH";
import type { criarClienteAdmin } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof criarClienteAdmin>;

/**
 * Recalcula UM horário real do turno a partir dos toques das equipes: "inicio" (Iniciar/Desfazer) ou
 * "fim" (Terminei/Desfazer). O outro horário não é tocado — correção do planejador sobrevive.
 * `apagar = false` (toque que acrescenta): sem valor calculado, mantém o que está gravado (ex.: fim digitado
 * pelo planejador quando nem todos terminaram; também evita que dois toques simultâneos gravem vazio).
 * Falha só loga (o toque vale).
 */
export async function sincronizarHorarioReal(
  admin: Admin,
  turnoId: string,
  campo: "inicio" | "fim",
  apagar: boolean,
): Promise<void> {
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
  const coluna = campo === "inicio" ? "hora_inicio_real" : "hora_fim_real";
  const valor = h[coluna];
  if (valor === null && !apagar) return;
  const { error } = await admin.from("turnos").update({ [coluna]: valor }).eq("id", turnoId);
  if (error) console.error("sincronizarHorarioReal (gravar):", error.message);
}
