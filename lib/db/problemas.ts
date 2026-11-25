import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ordenarProblemas, validarProblema, type DadosProblema, type Problema } from "@/lib/dominio/problemas";
import { falha, ok, type Resultado } from "./resultado";

const COLUNAS = "id, obra_id, tipo, descricao, acao, responsavel, prazo, resolvido_em, created_at";
const UUID_INVALIDO = "22P02";

/** Problemas da obra (RLS do planejador, ou admin do quadro público com a obra já resolvida pelo código). */
export async function listarProblemas(c: SupabaseClient, obraId: string, soAbertos = false): Promise<Problema[]> {
  let q = c.from("problemas_quadro").select(COLUNAS).eq("obra_id", obraId);
  if (soAbertos) q = q.is("resolvido_em", null);
  const { data, error } = await q;
  if (error) {
    if (error.code === UUID_INVALIDO) return [];
    console.error("listarProblemas:", error.message);
    throw new Error(`listarProblemas: ${error.message}`);
  }
  return ordenarProblemas((data ?? []) as Problema[]);
}

export async function criarProblema(c: SupabaseClient, obraId: string, dados: DadosProblema): Promise<Resultado<Problema>> {
  const v = validarProblema(dados);
  if (!v.ok) return falha(v.erro);
  const { data, error } = await c.from("problemas_quadro").insert({ obra_id: obraId, ...v.dados }).select(COLUNAS).maybeSingle();
  if (error || !data) {
    if (error) console.error("criarProblema:", error.message);
    return falha("Não foi possível salvar.");
  }
  return ok(data as Problema);
}

export async function editarProblema(c: SupabaseClient, id: string, dados: DadosProblema): Promise<Resultado<Problema>> {
  const v = validarProblema(dados);
  if (!v.ok) return falha(v.erro);
  const { data, error } = await c.from("problemas_quadro").update(v.dados).eq("id", id).select(COLUNAS).maybeSingle();
  if (error && error.code !== UUID_INVALIDO) {
    console.error("editarProblema:", error.message);
    return falha("Não foi possível salvar.");
  }
  if (!data) return falha("Item não encontrado.");
  return ok(data as Problema);
}

export async function definirResolvido(c: SupabaseClient, id: string, resolvido: boolean): Promise<Resultado> {
  const { data, error } = await c
    .from("problemas_quadro")
    .update({ resolvido_em: resolvido ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error && error.code !== UUID_INVALIDO) {
    console.error("definirResolvido:", error.message);
    return falha("Não foi possível salvar.");
  }
  if (!data || data.length === 0) return falha("Item não encontrado.");
  return ok(undefined);
}

export async function apagarProblema(c: SupabaseClient, id: string): Promise<Resultado> {
  const { data, error } = await c.from("problemas_quadro").delete().eq("id", id).select("id");
  if (error && error.code !== UUID_INVALIDO) {
    console.error("apagarProblema:", error.message);
    return falha("Não foi possível apagar.");
  }
  if (!data || data.length === 0) return falha("Item não encontrado.");
  return ok(undefined);
}
