"use server";

import { editarIntervalosObra, obterIntervalosObra } from "@/lib/db/obras";
import { falha, type Resultado } from "@/lib/db/resultado";
import type { Janela } from "@/lib/dominio/efetivoHH";
import type { Periodo } from "@/lib/dominio/tipos";
import { criarClienteServidor } from "@/lib/supabase/servidor";

/** Troca o intervalo padrão de um período da obra (vale para turnos criados depois). */
export async function salvarIntervaloObraAcao(obraId: string, periodo: Periodo, j: Janela | null): Promise<Resultado> {
  const c = await criarClienteServidor();
  const atual = await obterIntervalosObra(c, obraId);
  if (!atual) return falha("Obra não encontrada");
  return editarIntervalosObra(c, obraId, { ...atual, [periodo]: j });
}
