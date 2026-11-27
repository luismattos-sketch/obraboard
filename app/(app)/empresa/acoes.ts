"use server";

import { editarNomeEmpresa } from "@/lib/db/empresas";
import type { Resultado } from "@/lib/db/resultado";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export async function salvarNomeEmpresaAcao(nome: string): Promise<Resultado<{ nome: string }>> {
  return editarNomeEmpresa(await criarClienteServidor(), nome);
}
