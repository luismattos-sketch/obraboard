"use server";

import { revalidatePath } from "next/cache";
import { apagarProblema, criarProblema, definirResolvido, editarProblema } from "@/lib/db/problemas";
import { gerarLinkQuadro } from "@/lib/db/quadro";
import type { DadosProblema, Problema } from "@/lib/dominio/problemas";
import type { Resultado } from "@/lib/db/resultado";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export async function gerarLinkQuadroAcao(obraId: string): Promise<Resultado<{ codigo: string }>> {
  const r = await gerarLinkQuadro(await criarClienteServidor(), obraId);
  // Sem isso, Voltar/Avançar reaproveita a página com o código antigo (já sem validade).
  if (r.ok) revalidatePath(`/obras/${obraId}`);
  return r;
}

export async function criarProblemaAcao(obraId: string, dados: DadosProblema): Promise<Resultado<Problema>> {
  const r = await criarProblema(await criarClienteServidor(), obraId, dados);
  if (r.ok) revalidatePath(`/obras/${obraId}/quadro`);
  return r;
}

export async function editarProblemaAcao(obraId: string, id: string, dados: DadosProblema): Promise<Resultado<Problema>> {
  const r = await editarProblema(await criarClienteServidor(), id, dados);
  if (r.ok) revalidatePath(`/obras/${obraId}/quadro`);
  return r;
}

export async function definirResolvidoAcao(obraId: string, id: string, resolvido: boolean): Promise<Resultado> {
  const r = await definirResolvido(await criarClienteServidor(), id, resolvido);
  if (r.ok) revalidatePath(`/obras/${obraId}/quadro`);
  return r;
}

export async function apagarProblemaAcao(obraId: string, id: string): Promise<Resultado> {
  const r = await apagarProblema(await criarClienteServidor(), id);
  if (r.ok) revalidatePath(`/obras/${obraId}/quadro`);
  return r;
}
