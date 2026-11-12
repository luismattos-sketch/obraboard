"use server";

import { revalidatePath } from "next/cache";
import { criarResponsavel, definirAtivo, editarResponsavel, type Responsavel } from "@/lib/db/responsaveis";
import type { Resultado } from "@/lib/db/resultado";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export async function criarResponsavelAcao(
  obraId: string,
  dados: { nome: string; telefone?: string | null },
): Promise<Resultado<Responsavel>> {
  const r = await criarResponsavel(await criarClienteServidor(), obraId, dados);
  if (r.ok) revalidatePath(`/obras/${obraId}`, "layout");
  return r;
}

export async function editarResponsavelAcao(
  obraId: string,
  id: string,
  dados: { nome: string; telefone?: string | null },
): Promise<Resultado<Responsavel>> {
  const r = await editarResponsavel(await criarClienteServidor(), id, dados);
  if (r.ok) revalidatePath(`/obras/${obraId}`, "layout");
  return r;
}

export async function definirAtivoAcao(obraId: string, id: string, ativo: boolean): Promise<Resultado> {
  const r = await definirAtivo(await criarClienteServidor(), id, ativo);
  if (r.ok) revalidatePath(`/obras/${obraId}`, "layout");
  return r;
}
