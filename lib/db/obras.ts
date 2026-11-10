import type { SupabaseClient } from "@supabase/supabase-js";
import { falha, ok, type Resultado } from "./resultado";
import { errosDeTamanho, falhaCampos, LIMITES } from "./validacao";

/** Limites de nome/cliente/endereço da obra, por campo. */
export function errosObra(d: { nome?: string; cliente?: string; endereco?: string }): Record<string, string> {
  return errosDeTamanho({
    nome: { valor: d.nome, max: LIMITES.obraNome },
    cliente: { valor: d.cliente, max: LIMITES.obraCliente },
    endereco: { valor: d.endereco, max: LIMITES.obraEndereco },
  });
}

export type Obra = {
  id: string;
  empresa_id: string;
  nome: string;
  cliente: string | null;
  endereco: string | null;
  created_at: string;
};

const COLUNAS = "id, empresa_id, nome, cliente, endereco, created_at";

export async function listarObras(cliente: SupabaseClient): Promise<Obra[]> {
  const { data, error } = await cliente.from("obras").select(COLUNAS).order("nome");
  if (error) throw new Error(`listarObras: ${error.message}`);
  return (data ?? []) as Obra[];
}

export async function obterObra(cliente: SupabaseClient, id: string): Promise<Obra | null> {
  const { data, error } = await cliente.from("obras").select(COLUNAS).eq("id", id).maybeSingle();
  if (error) {
    if (error.code === "22P02") return null; // UUID inválido
    console.error("obterObra:", error.message);
    throw new Error(`obterObra: ${error.message}`);
  }
  return (data as Obra | null) ?? null;
}

export async function criarObra(
  cliente: SupabaseClient,
  dados: { nome: string; cliente?: string; endereco?: string },
): Promise<Resultado<Obra>> {
  const nome = dados.nome.trim();
  if (!nome) return falha("Informe o nome da obra");
  const tamanho = falhaCampos(errosObra(dados));
  if (tamanho) return tamanho;

  // MVP: cada usuário pertence a exatamente uma empresa.
  const { data: auth } = await cliente.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return falha("Sessão expirada. Entre novamente.");
  const { data: m, error: em } = await cliente
    .from("membros")
    .select("empresa_id")
    .eq("user_id", userId)
    .limit(1);
  if (em) {
    console.error("criarObra (membros):", em.message);
    return falha("Não foi possível criar a obra.");
  }
  if (!m || m.length === 0) return falha("Sua conta não está vinculada a uma empresa.");

  const { data, error } = await cliente
    .from("obras")
    .insert({
      empresa_id: m[0].empresa_id,
      nome,
      cliente: dados.cliente?.trim() || null,
      endereco: dados.endereco?.trim() || null,
    })
    .select(COLUNAS)
    .single();
  if (error || !data) {
    console.error("criarObra:", error?.message);
    return falha("Não foi possível criar a obra.");
  }
  return ok(data as Obra);
}
