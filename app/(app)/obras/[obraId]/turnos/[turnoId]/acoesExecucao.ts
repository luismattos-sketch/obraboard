"use server";

import { revalidatePath } from "next/cache";
import {
  removerClimaPlanejador,
  salvarClimaPlanejador,
  salvarEfetivoPlanejador,
  salvarExecucaoPlanejador,
  salvarHorarioPlanejador,
} from "@/lib/db/execucao";
import { criarOcorrenciaPlanejador, removerOcorrenciaPlanejador } from "@/lib/db/ocorrencias";
import type { Resultado } from "@/lib/db/resultado";
import type { DadosClima, DadosExecucao, DadosHorario, DadosOcorrencia, LinhaEfetivo } from "@/lib/db/validacao";
import type { ValoresExecucao } from "@/lib/dominio/conflito";
import type { PeriodoClima } from "@/lib/dominio/tipos";
import { criarClienteServidor } from "@/lib/supabase/servidor";

// Correções do planejador: sessão + RLS. A página é revalidada para o resumo refletir a correção.

async function comRevalidacao<T>(turnoId: string, fn: (c: Awaited<ReturnType<typeof criarClienteServidor>>) => Promise<Resultado<T>>) {
  const c = await criarClienteServidor();
  const r = await fn(c);
  if (r.ok) {
    const { data } = await c.from("turnos").select("obra_id").eq("id", turnoId).maybeSingle();
    const obraId = (data as { obra_id: string } | null)?.obra_id;
    if (obraId) revalidatePath(`/obras/${obraId}/turnos/${turnoId}`);
  }
  return r;
}

export async function corrigirExecucao(turnoId: string, atividadeId: string, dados: DadosExecucao, esperado: ValoresExecucao) {
  return comRevalidacao(turnoId, (c) => salvarExecucaoPlanejador(c, turnoId, atividadeId, dados, esperado));
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

export async function criarOcorrenciaAcao(turnoId: string, responsavelId: string | null, d: DadosOcorrencia) {
  return comRevalidacao(turnoId, (c) => criarOcorrenciaPlanejador(c, turnoId, responsavelId, d));
}

export async function removerOcorrenciaAcao(turnoId: string, id: string) {
  return comRevalidacao(turnoId, (c) => removerOcorrenciaPlanejador(c, turnoId, id));
}
