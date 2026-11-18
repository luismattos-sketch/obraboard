"use server";

import { revalidatePath } from "next/cache";
import {
  removerClimaPlanejador,
  salvarClimaPlanejador,
  salvarEfetivoPlanejador,
  salvarExecucaoPlanejador,
  salvarHorarioPlanejador,
  salvarIntervaloTurno,
} from "@/lib/db/execucao";
import type { Janela } from "@/lib/dominio/efetivoHH";
import { criarOcorrenciaPlanejador, encerrarParadaPlanejador, removerOcorrenciaPlanejador } from "@/lib/db/ocorrencias";
import { enviarFotoExtraPlanejador, enviarFotoParadaPlanejador } from "@/lib/db/fotosParada";
import { lancarExtraPlanejador, puxarPlanejador, removerForaDoDiaPlanejador } from "@/lib/db/foraDoDia";
import type { DadosExtra, ModoPuxar } from "@/lib/dominio/foraDoDia";
import { falha, ok, type Resultado } from "@/lib/db/resultado";
import { lerOcorrencias, lerTerminados, type Ocorrencia, type Terminado } from "@/lib/dominio/efetivoHH";
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

export async function corrigirIntervalo(turnoId: string, j: Janela | null) {
  return comRevalidacao(turnoId, (c) => salvarIntervaloTurno(c, turnoId, j));
}

export async function encerrarParadaAcao(turnoId: string, id: string, horaFim: string) {
  return comRevalidacao(turnoId, (c) => encerrarParadaPlanejador(c, turnoId, id, horaFim));
}

export async function enviarFotoParadaAcao(turnoId: string, ocorrenciaId: string, form: FormData) {
  return comRevalidacao(turnoId, (c) => enviarFotoParadaPlanejador(c, turnoId, ocorrenciaId, form));
}

/** Faixa do turno: só paradas abertas e "terminei" (consultado a cada 30 s, sem recarregar a página). */
export async function paradasDoTurnoAcao(turnoId: string): Promise<Resultado<{ abertas: Ocorrencia[]; terminados: Terminado[] }>> {
  const c = await criarClienteServidor();
  const [a, t] = await Promise.all([
    c.from("efetivo_ocorrencias").select("*").eq("turno_id", turnoId).eq("tipo", "parado").is("hora_fim", null),
    c.from("turno_equipes_terminadas").select("responsavel_id, terminou_em").eq("turno_id", turnoId),
  ]);
  if (a.error || t.error) return falha("Não foi possível atualizar.");
  return ok({ abertas: lerOcorrencias(a.data), terminados: lerTerminados(t.data) });
}

export async function puxarDaSemanaAcao(turnoId: string, programacaoAtividadeId: string, modo: ModoPuxar) {
  return comRevalidacao(turnoId, (c) => puxarPlanejador(c, turnoId, programacaoAtividadeId, modo));
}

export async function lancarExtraAcao(turnoId: string, dados: DadosExtra) {
  return comRevalidacao(turnoId, (c) => lancarExtraPlanejador(c, turnoId, dados));
}

export async function removerForaDoDiaAcao(turnoId: string, atividadeId: string) {
  return comRevalidacao(turnoId, (c) => removerForaDoDiaPlanejador(c, turnoId, atividadeId));
}

export async function enviarFotoExtraAcao(turnoId: string, atividadeId: string, form: FormData) {
  return comRevalidacao(turnoId, (c) => enviarFotoExtraPlanejador(c, turnoId, atividadeId, form));
}
