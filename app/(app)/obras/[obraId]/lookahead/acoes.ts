"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apagarItemManual, importarCronograma, obterItemCronograma, salvarItemManual } from "@/lib/db/cronograma";
import { criarRascunho } from "@/lib/db/programacao";
import { falha, ok, type Resultado } from "@/lib/db/resultado";
import { lerQuantidade, type ItemLido, type Mapeamento } from "@/lib/dominio/cronograma";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export type EstadoLookahead = (Resultado<string | undefined> & { envio?: number }) | null;

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const atualizar = () => revalidatePath("/obras/[obraId]/lookahead", "page");

export async function importarCronogramaAcao(
  obraId: string,
  arquivo: string,
  mapeamento: Mapeamento,
  itens: ItemLido[],
): Promise<Resultado<string>> {
  const r = await importarCronograma(await criarClienteServidor(), obraId, arquivo, mapeamento, itens);
  if (!r.ok) return r;
  atualizar();
  const { novos, atualizados, removidos } = r.dados;
  return ok(`Cronograma importado: ${novos} novos · ${atualizados} atualizados · ${removidos} saem do cronograma.`);
}

export async function salvarItemManualAcao(_: EstadoLookahead, form: FormData): Promise<EstadoLookahead> {
  const r = await salvarItemManual(
    await criarClienteServidor(),
    texto(form, "obra_id"),
    {
      descricao: texto(form, "descricao"),
      inicio: texto(form, "inicio"),
      fim: texto(form, "fim"),
      local: texto(form, "local") || null,
      unidade: texto(form, "unidade") || null,
      quantidade: texto(form, "quantidade") ? (lerQuantidade(texto(form, "quantidade")) ?? NaN) : null,
    },
    texto(form, "item_id") || undefined,
  );
  if (!r.ok) return { ...falha(r.erro, r.campos), envio: Date.now() };
  atualizar();
  return { ...ok(undefined), envio: Date.now() };
}

export async function apagarItemManualAcao(_: EstadoLookahead, form: FormData): Promise<EstadoLookahead> {
  const r = await apagarItemManual(await criarClienteServidor(), texto(form, "item_id"));
  if (!r.ok) return { ...falha(r.erro), envio: Date.now() };
  atualizar();
  return { ...ok(undefined), envio: Date.now() };
}

/** Cria (ou reaproveita) o rascunho da semana e abre a Programação com o formulário preenchido. */
export async function levarParaSemanaAcao(_: EstadoLookahead, form: FormData): Promise<EstadoLookahead> {
  const c = await criarClienteServidor();
  const item = await obterItemCronograma(c, texto(form, "item_id"));
  if (!item) return { ...falha("Item não encontrado."), envio: Date.now() };
  const r = await criarRascunho(c, item.obra_id, texto(form, "segunda"));
  if (!r.ok) return { ...falha(r.erro), envio: Date.now() };
  if (r.dados.status !== "rascunho") return { ...falha("Semana já programada."), envio: Date.now() };
  redirect(`/obras/${item.obra_id}/programacao/${r.dados.inicio}?item=${item.id}`);
}
