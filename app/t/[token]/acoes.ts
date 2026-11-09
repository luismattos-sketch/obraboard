"use server";

import {
  enviarTurnoCampo,
  salvarClima as dbSalvarClima,
  salvarEfetivo as dbSalvarEfetivo,
  salvarExecucao as dbSalvarExecucao,
  salvarHorarioReal as dbSalvarHorarioReal,
} from "@/lib/db/campo";
import type { Causa, CondicaoClima, PeriodoClima } from "@/lib/dominio/tipos";

// O token vem do cliente (já está na URL); cada função o revalida no servidor. Nunca logar o token.

export async function salvarExecucao(
  token: string,
  atividadeId: string,
  dados: { qtd_realizada: number | null; causa: Causa | null; observacao: string | null },
) {
  return dbSalvarExecucao(token, atividadeId, dados);
}

export async function salvarEfetivo(token: string, linhas: { funcao: string; quantidade: number }[]) {
  return dbSalvarEfetivo(token, linhas);
}

export async function salvarClima(
  token: string,
  dados: { periodo: PeriodoClima; condicao: CondicaoClima; impediu: boolean },
) {
  return dbSalvarClima(token, dados);
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
