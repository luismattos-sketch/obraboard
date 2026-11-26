"use server";

import { revalidatePath } from "next/cache";
import { buscarCidades } from "@/lib/clima/openmeteo";
import type { Cidade } from "@/lib/clima/tipos";
import { editarCidadeObra } from "@/lib/db/obras";
import type { Resultado } from "@/lib/db/resultado";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export async function buscarCidadesAcao(termo: string): Promise<Cidade[]> {
  return buscarCidades(String(termo ?? ""));
}

export async function salvarCidadeObraAcao(obraId: string, cidade: Cidade): Promise<Resultado> {
  const r = await editarCidadeObra(await criarClienteServidor(), obraId, cidade);
  if (r.ok) revalidatePath(`/obras/${obraId}`, "layout");
  return r;
}
