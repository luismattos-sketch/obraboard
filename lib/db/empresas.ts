import "server-only";
import { criarClienteAdmin } from "@/lib/supabase/admin";

export type EtapaFalha = "consulta" | "criacao";

export type ResultadoEmpresa =
  | { ok: true; dados: { empresaId: string; criada: boolean } }
  | { ok: false; erro: string; etapa: EtapaFalha };

/** Só remove o usuário se a consulta funcionou (sem vínculo) e a criação falhou. */
export function deveRemoverUsuario(r: ResultadoEmpresa): boolean {
  return !r.ok && r.etapa === "criacao";
}

const falhar = (erro: string, etapa: EtapaFalha): ResultadoEmpresa => ({ ok: false, erro, etapa });

export async function criarEmpresaDoDono(
  userId: string,
  nome: string,
): Promise<ResultadoEmpresa> {
  const admin = criarClienteAdmin();
  // Idempotente: se o usuário já é membro, devolve a empresa existente.
  const { data: existente, error: ee } = await admin
    .from("membros")
    .select("empresa_id")
    .eq("user_id", userId)
    .limit(1);
  if (ee) return falhar("Não foi possível criar a empresa.", "consulta");
  if (existente && existente.length > 0) {
    return { ok: true, dados: { empresaId: existente[0].empresa_id as string, criada: false } };
  }

  const { data: emp, error } = await admin
    .from("empresas")
    .insert({ nome })
    .select("id")
    .single();
  if (error || !emp) return falhar("Não foi possível criar a empresa.", "criacao");

  const { error: em } = await admin
    .from("membros")
    .insert({ empresa_id: emp.id, user_id: userId, papel: "dono" });
  if (em) {
    await admin.from("empresas").delete().eq("id", emp.id);
    return falhar("Não foi possível vincular o usuário à empresa.", "criacao");
  }
  return { ok: true, dados: { empresaId: emp.id, criada: true } };
}
