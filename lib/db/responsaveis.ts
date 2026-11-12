import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResponsavelRef } from "@/lib/dominio/quadro";
import { ERRO_RESPONSAVEL_DUPLICADO } from "./mensagens";
import { falha, ok, type Resultado } from "./resultado";

export type Responsavel = ResponsavelRef & { obra_id: string; telefone: string | null };

const COLUNAS = "id, obra_id, nome, telefone, ativo";
const ERRO_GENERICO = "Não foi possível salvar o responsável.";

function validar(dados: { nome: string; telefone?: string | null }): Resultado<{ nome: string; telefone: string | null }> {
  const nome = typeof dados.nome === "string" ? dados.nome.trim() : "";
  if (!nome) return falha("Informe o nome do responsável");
  if (nome.length > 60) return falha("Nome com até 60 caracteres");
  const tel = typeof dados.telefone === "string" ? dados.telefone.trim() : "";
  if (tel.length > 30) return falha("Telefone com até 30 caracteres");
  return ok({ nome, telefone: tel || null });
}

function erroGravacao(error: { code?: string; message?: string }, onde: string): Resultado<never> {
  if (error.code === "23505") return falha(ERRO_RESPONSAVEL_DUPLICADO);
  console.error(`${onde}:`, error.message);
  return falha(ERRO_GENERICO);
}

/** Ativos e inativos, em ordem alfabética. */
export async function listarResponsaveis(c: SupabaseClient, obraId: string): Promise<Responsavel[]> {
  const { data, error } = await c.from("responsaveis").select(COLUNAS).eq("obra_id", obraId);
  if (error) {
    if (error.code === "22P02") return [];
    console.error("listarResponsaveis:", error.message);
    throw new Error(`listarResponsaveis: ${error.message}`);
  }
  return ((data ?? []) as Responsavel[]).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function criarResponsavel(
  c: SupabaseClient,
  obraId: string,
  dados: { nome: string; telefone?: string | null },
): Promise<Resultado<Responsavel>> {
  const v = validar(dados);
  if (!v.ok) return v;
  const { data, error } = await c.from("responsaveis").insert({ obra_id: obraId, ...v.dados }).select(COLUNAS).single();
  if (error || !data) return erroGravacao(error ?? {}, "criarResponsavel");
  return ok(data as Responsavel);
}

export async function editarResponsavel(
  c: SupabaseClient,
  id: string,
  dados: { nome: string; telefone?: string | null },
): Promise<Resultado<Responsavel>> {
  const v = validar(dados);
  if (!v.ok) return v;
  const { data, error } = await c.from("responsaveis").update(v.dados).eq("id", id).select(COLUNAS).maybeSingle();
  if (error) return erroGravacao(error, "editarResponsavel");
  if (!data) return falha("Responsável não encontrado");
  return ok(data as Responsavel);
}

export async function definirAtivo(c: SupabaseClient, id: string, ativo: boolean): Promise<Resultado> {
  const { data, error } = await c.from("responsaveis").update({ ativo }).eq("id", id).select("id").maybeSingle();
  if (error) return erroGravacao(error, "definirAtivo");
  if (!data) return falha("Responsável não encontrado");
  return ok(undefined);
}
