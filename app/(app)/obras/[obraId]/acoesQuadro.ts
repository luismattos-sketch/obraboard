"use server";

import { gerarLinkQuadro } from "@/lib/db/quadro";
import type { Resultado } from "@/lib/db/resultado";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export async function gerarLinkQuadroAcao(obraId: string): Promise<Resultado<{ codigo: string }>> {
  return gerarLinkQuadro(await criarClienteServidor(), obraId);
}
