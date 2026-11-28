"use server";

import { revalidatePath } from "next/cache";
import { gerarLinkCiencia } from "@/lib/db/ciencia";
import type { Resultado } from "@/lib/db/resultado";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export async function gerarLinkCienciaAcao(obraId: string, semana: string): Promise<Resultado<{ codigo: string }>> {
  const r = await gerarLinkCiencia(await criarClienteServidor(), obraId, semana);
  if (r.ok) revalidatePath(`/obras/${obraId}`);
  return r;
}
