import "server-only";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { falha, ok, type Resultado } from "./resultado";

export async function criarEmpresaDoDono(
  userId: string,
  nome: string,
): Promise<Resultado<{ empresaId: string }>> {
  const admin = criarClienteAdmin();
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
  return ok({ empresaId: emp.id });
}
