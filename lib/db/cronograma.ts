// Item 5.1: cronograma da obra (importado ou manual) para o lookahead.
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_LINHAS, type ItemCronograma, type ItemLido, type Mapeamento } from "@/lib/dominio/cronograma";
import { falha, ok, type Resultado } from "./resultado";

const COLUNAS = "id, origem, codigo, descricao, inicio, fim, local, unidade, quantidade, removido_em, updated_at";
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const itemDe = (r: Record<string, unknown>): ItemCronograma => ({
  id: r.id as string,
  origem: r.origem as ItemCronograma["origem"],
  codigo: (r.codigo as string | null) ?? null,
  descricao: r.descricao as string,
  inicio: r.inicio as string,
  fim: r.fim as string,
  local: (r.local as string | null) ?? null,
  unidade: (r.unidade as string | null) ?? null,
  quantidade: r.quantidade === null || r.quantidade === undefined ? null : Number(r.quantidade),
  removido_em: (r.removido_em as string | null) ?? null,
  updated_at: r.updated_at as string,
});

export async function listarItensCronograma(
  c: SupabaseClient,
  obraId: string,
  opcoes: { incluirRemovidos?: boolean } = {},
): Promise<ItemCronograma[]> {
  let q = c.from("cronograma_itens").select(COLUNAS).eq("obra_id", obraId);
  if (!opcoes.incluirRemovidos) q = q.is("removido_em", null);
  const { data, error } = await q.order("inicio").order("codigo", { nullsFirst: false }).order("created_at");
  if (error) {
    console.error("listarItensCronograma:", error.message);
    return [];
  }
  return (data ?? []).map(itemDe);
}

export async function obterItemCronograma(c: SupabaseClient, id: string): Promise<(ItemCronograma & { obra_id: string }) | null> {
  const { data } = await c.from("cronograma_itens").select(`${COLUNAS}, obra_id`).eq("id", id).maybeSingle();
  return data ? { ...itemDe(data), obra_id: data.obra_id as string } : null;
}

/** Por item: as semanas (segunda) onde ele já virou atividade, com a criação da atividade. */
export async function levadasPorItem(
  c: SupabaseClient,
  obraId: string,
): Promise<Map<string, { inicio: string; created_at: string }[]>> {
  const { data, error } = await c
    .from("programacao_atividades")
    .select("cronograma_item_id, created_at, semanas!inner(obra_id, inicio)")
    .eq("semanas.obra_id", obraId)
    .not("cronograma_item_id", "is", null)
    .order("created_at");
  const mapa = new Map<string, { inicio: string; created_at: string }[]>();
  if (error) {
    console.error("levadasPorItem:", error.message);
    return mapa;
  }
  for (const r of data ?? []) {
    const s = (Array.isArray(r.semanas) ? r.semanas[0] : r.semanas) as { inicio: string } | null;
    if (!s) continue;
    const id = r.cronograma_item_id as string;
    const lista = mapa.get(id) ?? [];
    lista.push({ inicio: s.inicio, created_at: r.created_at as string });
    mapa.set(id, lista);
  }
  return mapa;
}

export async function importarCronograma(
  c: SupabaseClient,
  obraId: string,
  arquivo: string,
  mapeamento: Mapeamento,
  itens: ItemLido[],
): Promise<Resultado<{ novos: number; atualizados: number; removidos: number }>> {
  if (itens.length === 0) return falha("Nenhuma linha válida no arquivo.");
  if (itens.length > MAX_LINHAS) return falha("Arquivo grande demais (máx. 5 MB / 5.000 linhas).");
  const { data, error } = await c.rpc("importar_cronograma", {
    p_obra: obraId,
    p_arquivo: arquivo.slice(0, 200) || "cronograma",
    p_mapeamento: mapeamento,
    p_linhas: itens,
  });
  if (error) {
    console.error("importarCronograma:", error.message);
    return falha("Não foi possível importar o cronograma.");
  }
  const r = data as { novos: number; atualizados: number; removidos: number };
  return ok({ novos: r.novos, atualizados: r.atualizados, removidos: r.removidos });
}

export async function ultimaImportacao(
  c: SupabaseClient,
  obraId: string,
): Promise<{ arquivo_nome: string; mapeamento: Mapeamento; created_at: string } | null> {
  const { data } = await c
    .from("cronograma_importacoes")
    .select("arquivo_nome, mapeamento, created_at")
    .eq("obra_id", obraId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { arquivo_nome: data.arquivo_nome as string, mapeamento: data.mapeamento as Mapeamento, created_at: data.created_at as string } : null;
}

export type EntradaItemManual = Omit<ItemLido, "codigo">;

export async function salvarItemManual(
  c: SupabaseClient,
  obraId: string,
  e: EntradaItemManual,
  id?: string,
): Promise<Resultado<ItemCronograma>> {
  const descricao = e.descricao?.trim() ?? "";
  const campos: Record<string, string> = {};
  if (!descricao) campos.descricao = "Informe a descrição";
  else if (descricao.length > 500) campos.descricao = "Descrição muito longa (máx. 500)";
  if (!ISO.test(e.inicio ?? "")) campos.inicio = "Informe o início";
  if (!ISO.test(e.fim ?? "")) campos.fim = "Informe o término";
  else if (ISO.test(e.inicio ?? "") && e.fim < e.inicio) campos.fim = "O término é antes do início";
  if (e.quantidade !== null && !(Number.isFinite(e.quantidade) && e.quantidade > 0)) campos.quantidade = "Quantidade inválida";
  const primeira = Object.values(campos)[0];
  if (primeira) return falha(primeira, campos);
  const linha = {
    descricao, inicio: e.inicio, fim: e.fim,
    local: e.local?.trim() || null, unidade: e.unidade?.trim() || null, quantidade: e.quantidade,
  };
  if (id) {
    const atual = await obterItemCronograma(c, id);
    if (!atual || atual.obra_id !== obraId) return falha("Item não encontrado.");
    if (atual.origem !== "manual") return falha("Itens do cronograma importado não se editam aqui; crie um item manual.");
    const { data, error } = await c
      .from("cronograma_itens")
      .update({ ...linha, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(COLUNAS)
      .single();
    if (error) return falha("Não foi possível salvar o item.");
    return ok(itemDe(data));
  }
  const { data, error } = await c
    .from("cronograma_itens")
    .insert({ ...linha, obra_id: obraId, origem: "manual" })
    .select(COLUNAS)
    .single();
  if (error) {
    console.error("salvarItemManual:", error.message);
    return falha("Não foi possível salvar o item.");
  }
  return ok(itemDe(data));
}

export async function apagarItemManual(c: SupabaseClient, id: string): Promise<Resultado> {
  const atual = await obterItemCronograma(c, id);
  if (!atual) return falha("Item não encontrado.");
  if (atual.origem !== "manual") return falha("Itens do cronograma importado não se apagam aqui.");
  const { error } = await c.from("cronograma_itens").delete().eq("id", id);
  if (error) return falha("Não foi possível apagar o item.");
  return ok(undefined);
}
