"use server";

import { revalidatePath } from "next/cache";
import {
  removerClimaPlanejador,
  salvarClimaPlanejador,
  salvarEfetivoPlanejador,
  salvarExecucaoPlanejador,
  salvarHorarioPlanejador,
} from "@/lib/db/execucao";
import type { Resultado } from "@/lib/db/resultado";
import type { DadosClima, DadosExecucao, DadosHorario, LinhaEfetivo } from "@/lib/db/validacao";
import type { PeriodoClima } from "@/lib/dominio/tipos";
import { criarClienteServidor } from "@/lib/supabase/servidor";

// Correções do planejador: sessão + RLS. A página é revalidada para o resumo refletir a correção.

async function comRevalidacao(turnoId: string, fn: (c: Awaited<ReturnType<typeof criarClienteServidor>>) => Promise<Resultado>) {
  const c = await criarClienteServidor();
  const r = await fn(c);
  if (r.ok) {
    const { data } = await c.from("turnos").select("obra_id").eq("id", turnoId).maybeSingle();
    const obraId = (data as { obra_id: string } | null)?.obra_id;
    if (obraId) revalidatePath(`/obras/${obraId}/turnos/${turnoId}`);
  }
  return r;
}

export async function corrigirExecucao(turnoId: string, atividadeId: string, dados: DadosExecucao) {
  return comRevalidacao(turnoId, (c) => salvarExecucaoPlanejador(c, turnoId, atividadeId, dados));
}

export async function corrigirEfetivo(turnoId: string, responsavelId: string | null, linhas: LinhaEfetivo[], esperado: LinhaEfetivo[]) {
  return comRevalidacao(turnoId, (c) => salvarEfetivoPlanejador(c, turnoId, responsavelId, linhas, esperado));
}

export async function corrigirClima(turnoId: string, dados: DadosClima) {
  return comRevalidacao(turnoId, (c) => salvarClimaPlanejador(c, turnoId, dados));
}

export async function limparClimaPlanejador(turnoId: string, periodo: PeriodoClima) {
  return comRevalidacao(turnoId, (c) => removerClimaPlanejador(c, turnoId, periodo));
}

export async function corrigirHorario(turnoId: string, dados: DadosHorario) {
  return comRevalidacao(turnoId, (c) => salvarHorarioPlanejador(c, turnoId, dados));
}
