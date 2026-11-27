import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validarNomeEmpresa } from "@/lib/dominio/empresa";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { falha, ok, type Resultado } from "./resultado";

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

/** Nome atual da empresa do usuário (a RLS só devolve a dele). Falha = null: o RDO sai sem o nome. */
export async function obterNomeEmpresa(c: SupabaseClient): Promise<string | null> {
  const { data, error } = await c.from("empresas").select("nome").limit(1);
  if (error) {
    console.error("obterNomeEmpresa:", error.message);
    return null;
  }
  return (data?.[0]?.nome as string | undefined) ?? null;
}

/**
 * O usuário só lê empresas (sem grant de update): o vínculo de dono é conferido com o cliente
 * dele (RLS de membros = só as próprias linhas) e a gravação usa o admin filtrando por esse id.
 */
export async function editarNomeEmpresa(c: SupabaseClient, bruto: string): Promise<Resultado<{ nome: string }>> {
  const v = validarNomeEmpresa(bruto);
  if (!v.ok) return falha(v.erro);
  const { data: auth } = await c.auth.getUser();
  if (!auth.user) return falha("Sessão expirada. Entre de novo.");
  const { data: vinculo, error: ev } = await c
    .from("membros")
    .select("empresa_id")
    .eq("user_id", auth.user.id)
    .eq("papel", "dono")
    .limit(1);
  if (ev) throw new Error(ev.message);
  const empresaId = vinculo?.[0]?.empresa_id as string | undefined;
  if (!empresaId) return falha("Só o dono da empresa pode mudar o nome.");
  const { error } = await criarClienteAdmin().from("empresas").update({ nome: v.nome }).eq("id", empresaId);
  if (error) return falha("Não foi possível salvar o nome.");
  return ok({ nome: v.nome });
}
