"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_RESPONSAVEL } from "@/lib/dominio/quadro";
import {
  enviarTurnoCampo,
  lancarExtraCampo,
  puxarCampo,
  removerForaDoDiaCampo,
  salvarEfetivo as dbSalvarEfetivo,
  salvarExecucao as dbSalvarExecucao,
  salvarHorarioReal as dbSalvarHorarioReal,
} from "@/lib/db/campo";
import { criarOcorrenciaCampo, encerrarParadaCampo, removerOcorrenciaCampo } from "@/lib/db/ocorrencias";
import { enviarFotoExtraCampo, enviarFotoParadaCampo } from "@/lib/db/fotosParada";
import type { DadosExtra, ModoPuxar } from "@/lib/dominio/foraDoDia";
import { desfazerTerminouCampo, marcarTerminouCampo } from "@/lib/db/terminados";
import { desfazerIniciouCampo, marcarIniciouCampo } from "@/lib/db/iniciados";
import { lancarRelatoCampo, organizarRelatoCampo } from "@/lib/db/relatoCampo";
import type { DadosOcorrencia, LinhaEfetivo } from "@/lib/db/validacao";
import type { ValoresExecucao } from "@/lib/dominio/conflito";
import type { DadosExecucao } from "@/lib/dominio/tipos";

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

export async function marcarInicio(token: string, responsavelId: string, hora: string) {
  return marcarIniciouCampo(token, responsavelId, hora);
}

export async function desfazerInicio(token: string, responsavelId: string) {
  return desfazerIniciouCampo(token, responsavelId);
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

/** "Conte como foi o dia": guarda o texto e devolve a prévia da IA (nada grava nas atividades). */
export async function organizarRelato(token: string, responsavelId: string, texto: string, relatoId: string | null) {
  return organizarRelatoCampo(token, responsavelId, texto, relatoId);
}

export async function lancarRelato(token: string, responsavelId: string, relatoId: string) {
  return lancarRelatoCampo(token, responsavelId, relatoId);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "Sou eu": lembra a escolha só para este link (cookie no caminho do token), para não perguntar de novo ao reabrir. */
export async function lembrarResponsavel(token: string, responsavelId: string) {
  if (!UUID.test(responsavelId) || !/^[\w-]+$/.test(token)) redirect(`/t/${encodeURIComponent(token)}`);
  (await cookies()).set(COOKIE_RESPONSAVEL, responsavelId, {
    path: `/t/${token}`,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 3,
  });
  redirect(`/t/${token}?r=${responsavelId}`);
}
