"use server";

import { revalidatePath } from "next/cache";
import { gerarLinkQuadro } from "@/lib/db/quadro";
import type { Resultado } from "@/lib/db/resultado";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export async function gerarLinkQuadroAcao(obraId: string): Promise<Resultado<{ codigo: string }>> {
  const r = await gerarLinkQuadro(await criarClienteServidor(), obraId);
  // Sem isso, Voltar/Avançar reaproveita a página com o código antigo (já sem validade).
  if (r.ok) revalidatePath(`/obras/${obraId}`);
  return r;
}
