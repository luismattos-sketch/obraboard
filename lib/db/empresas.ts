import "server-only";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { falha, ok, type Resultado } from "./resultado";

export async function criarEmpresaDoDono(
  userId: string,
  nome: string,
): Promise<Resultado<{ empresaId: string; criada: boolean }>> {
  const admin = criarClienteAdmin();
  // Idempotente: se o usuário já é membro, devolve a empresa existente.
  const { data: existente, error: ee } = await admin
    .from("membros")
    .select("empresa_id")
    .eq("user_id", userId)
    .limit(1);
  if (ee) return falha("Não foi possível criar a empresa.");
  if (existente && existente.length > 0) {
    return ok({ empresaId: existente[0].empresa_id as string, criada: false });
  }

  const { data: emp, error } = await admin
    .from("empresas")
    .insert({ nome })
    .select("id")
    .single();
  if (error || !emp) return falha("Não foi possível criar a empresa.");

  const { error: em } = await admin
    .from("membros")
    .insert({ empresa_id: emp.id, user_id: userId, papel: "dono" });
  if (em) {
    await admin.from("empresas").delete().eq("id", emp.id);
    return falha("Não foi possível vincular o usuário à empresa.");
  }
  return ok({ empresaId: emp.id, criada: true });
}
