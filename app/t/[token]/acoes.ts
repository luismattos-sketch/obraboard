"use server";

import {
  enviarTurnoCampo,
  lancarExtraCampo,
  puxarCampo,
  removerForaDoDiaCampo,
  removerClima as dbRemoverClima,
  salvarClima as dbSalvarClima,
  salvarEfetivo as dbSalvarEfetivo,
  salvarExecucao as dbSalvarExecucao,
  salvarHorarioReal as dbSalvarHorarioReal,
} from "@/lib/db/campo";
import { criarOcorrenciaCampo, encerrarParadaCampo, removerOcorrenciaCampo } from "@/lib/db/ocorrencias";
import { enviarFotoExtraCampo, enviarFotoParadaCampo } from "@/lib/db/fotosParada";
import type { DadosExtra, ModoPuxar } from "@/lib/dominio/foraDoDia";
import { desfazerTerminouCampo, marcarTerminouCampo } from "@/lib/db/terminados";
import type { DadosOcorrencia, LinhaEfetivo } from "@/lib/db/validacao";
import type { ValoresExecucao } from "@/lib/dominio/conflito";
import type { CondicaoClima, DadosExecucao, PeriodoClima } from "@/lib/dominio/tipos";

// O token vem do cliente (já está na URL); cada função o revalida no servidor. Nunca logar o token.

export async function salvarExecucao(
  token: string,
  atividadeId: string,
  dados: DadosExecucao,
  esperado: ValoresExecucao,
  responsavelId: string | null = null,
) {
  return dbSalvarExecucao(token, atividadeId, dados, esperado, responsavelId);
}

export async function salvarEfetivo(token: string, linhas: LinhaEfetivo[], esperado: LinhaEfetivo[], responsavelId: string | null = null) {
  return dbSalvarEfetivo(token, linhas, esperado, responsavelId);
}

export async function salvarClima(
  token: string,
  dados: { periodo: PeriodoClima; condicao: CondicaoClima; impediu: boolean },
) {
  return dbSalvarClima(token, dados);
}

export async function limparClima(token: string, periodo: PeriodoClima) {
  return dbRemoverClima(token, periodo);
}

export async function salvarHorarioReal(
  token: string,
  dados: { hora_inicio_real: string | null; hora_fim_real: string | null },
) {
  return dbSalvarHorarioReal(token, dados);
}

export async function enviarTurno(token: string) {
  return enviarTurnoCampo(token);
}

export async function criarOcorrencia(token: string, d: DadosOcorrencia, responsavelId: string | null) {
  return criarOcorrenciaCampo(token, d, responsavelId);
}

export async function removerOcorrencia(token: string, id: string, responsavelId: string | null) {
  return removerOcorrenciaCampo(token, id, responsavelId);
}

export async function encerrarParada(token: string, id: string, horaFim: string, responsavelId: string | null) {
  return encerrarParadaCampo(token, id, horaFim, responsavelId);
}

export async function marcarTerminou(token: string, responsavelId: string, hora: string) {
  return marcarTerminouCampo(token, responsavelId, hora);
}

export async function desfazerTerminou(token: string, responsavelId: string) {
  return desfazerTerminouCampo(token, responsavelId);
}

export async function enviarFotoParada(token: string, ocorrenciaId: string, responsavelId: string | null, form: FormData) {
  return enviarFotoParadaCampo(token, ocorrenciaId, responsavelId, form);
}

export async function puxarDaSemana(token: string, programacaoAtividadeId: string, modo: ModoPuxar, responsavelId: string) {
  return puxarCampo(token, programacaoAtividadeId, modo, responsavelId);
}

export async function lancarExtra(token: string, dados: DadosExtra, responsavelId: string) {
  return lancarExtraCampo(token, dados, responsavelId);
}

export async function removerForaDoDia(token: string, atividadeId: string, responsavelId: string) {
  return removerForaDoDiaCampo(token, atividadeId, responsavelId);
}

export async function enviarFotoExtra(token: string, atividadeId: string, responsavelId: string, form: FormData) {
  return enviarFotoExtraCampo(token, atividadeId, responsavelId, form);
}
