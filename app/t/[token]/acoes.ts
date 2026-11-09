"use server";

import {
  enviarTurnoCampo,
  removerClima as dbRemoverClima,
  salvarClima as dbSalvarClima,
  salvarEfetivo as dbSalvarEfetivo,
  salvarExecucao as dbSalvarExecucao,
  salvarHorarioReal as dbSalvarHorarioReal,
} from "@/lib/db/campo";
import type { LinhaEfetivo } from "@/lib/db/validacao";
import type { CondicaoClima, DadosExecucao, PeriodoClima } from "@/lib/dominio/tipos";

// O token vem do cliente (já está na URL); cada função o revalida no servidor. Nunca logar o token.

export async function salvarExecucao(
  token: string,
  atividadeId: string,
  dados: DadosExecucao,
) {
  return dbSalvarExecucao(token, atividadeId, dados);
}

export async function salvarEfetivo(token: string, linhas: LinhaEfetivo[], esperado: LinhaEfetivo[]) {
  return dbSalvarEfetivo(token, linhas, esperado);
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
