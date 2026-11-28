// Item 5.2: restrições dos itens do lookahead.
import type { SupabaseClient } from "@supabase/supabase-js";
import { validarRestricao, type DadosRestricao, type Restricao } from "@/lib/dominio/restricoes";
import { falha, ok, type Resultado } from "./resultado";

const COLUNAS = "id, cronograma_item_id, tipo, descricao, responsavel, prazo, removida_em, created_at";

/** Restrições da obra agrupadas pelo item do lookahead. */
export async function listarRestricoesDaObra(c: SupabaseClient, obraId: string): Promise<Map<string, Restricao[]>> {
  const { data, error } = await c
    .from("restricoes")
    .select(`${COLUNAS}, cronograma_itens!inner(obra_id)`)
    .eq("cronograma_itens.obra_id", obraId)
    .order("created_at");
  const mapa = new Map<string, Restricao[]>();
  if (error) {
    console.error("listarRestricoesDaObra:", error.message);
    return mapa;
  }
  for (const r of data ?? []) {
    const linha = { ...(r as Record<string, unknown>) };
    delete linha.cronograma_itens;
    const restricao = linha as unknown as Restricao;
    const lista = mapa.get(restricao.cronograma_item_id) ?? [];
    lista.push(restricao);
    mapa.set(restricao.cronograma_item_id, lista);
  }
  return mapa;
}

export async function salvarRestricao(
  c: SupabaseClient,
  itemId: string,
  d: DadosRestricao,
  id?: string,
): Promise<Resultado<Restricao>> {
  const v = validarRestricao(d);
  if (!v.ok) return falha(v.erro, v.campos);
  const q = id
    ? c.from("restricoes").update({ ...v.dados, updated_at: new Date().toISOString() }).eq("id", id).eq("cronograma_item_id", itemId)
    : c.from("restricoes").insert({ ...v.dados, cronograma_item_id: itemId });
  const { data, error } = await q.select(COLUNAS).maybeSingle();
  if (error || !data) {
    if (error) console.error("salvarRestricao:", error.message);
    return falha("Não foi possível salvar a restrição.");
  }
  return ok(data as Restricao);
}

export async function marcarRemovida(c: SupabaseClient, id: string, removida: boolean): Promise<Resultado> {
  const { data, error } = await c
    .from("restricoes")
    .update({ removida_em: removida ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) return falha("Não foi possível atualizar a restrição.");
  return ok(undefined);
}

export async function apagarRestricao(c: SupabaseClient, id: string): Promise<Resultado> {
  const { data, error } = await c.from("restricoes").delete().eq("id", id).select("id").maybeSingle();
  if (error || !data) return falha("Não foi possível apagar a restrição.");
  return ok(undefined);
}
