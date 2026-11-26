import "server-only";
import { statusAtividade } from "@/lib/dominio/calculos";
import { hashToken } from "@/lib/dominio/token";
import type { DadosExecucao, StatusTurno } from "@/lib/dominio/tipos";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import type { ResponsavelRef } from "@/lib/dominio/quadro";
import type { ValoresExecucao } from "@/lib/dominio/conflito";
import { conflitoOuJaGravado, filtrarEsperado, lerValores } from "./execucao";
import { lancarExtra, opcoesDoTurno, puxarDaSemana, reajustarCopiasFuturas, removerForaDoDia } from "./foraDoDia";
import { SEM_OPCOES, type ModoPuxar, type OpcoesPuxar } from "@/lib/dominio/foraDoDia";
import {
  ERRO_EFETIVO_CONFLITO,
  ERRO_ENVIO_POR_TERMINEI,
  ERRO_HORARIO_POR_INICIAR,
  ERRO_EXTRA_SEM_QTD,
  ERRO_FECHADO_CAMPO,
  ERRO_RESPONSAVEL_INVALIDO,
  erroBanco,
} from "./mensagens";
import { falha, falhaConflito, ok, type Resultado } from "./resultado";
import { opcoesFuncaoDoTurno, semanaDoTurno } from "./programacao";
import { aplicarAcao, obterTurnoCompleto, type TurnoCompleto } from "./turnos";
import {
  camposExecucao,
  validarEfetivo,
  validarEfetivoEsperado,
  validarExecucao,
  validarHorario,
  type LinhaEfetivo,
} from "./validacao";

/**
 * Acesso do encarregado por link secreto. Usa o cliente admin (ignora RLS):
 * TODA consulta aqui é escopada ao turno resolvido pelo hash do token.
 */

export const ERRO_LINK = "Link inválido ou substituído. Peça um novo link ao planejador.";
export const ERRO_FECHADO = ERRO_FECHADO_CAMPO;
export const ERRO_ATIVIDADE = "Esta atividade foi removida pelo planejador. Recarregue a página.";
const ERRO_GENERICO = "Não foi possível salvar. Tente novamente.";

/** Turno fechado entre a checagem e a gravação (trigger do banco) vira a mensagem do encarregado. */
const erroGravacao = (error: { code?: string; message?: string }) =>
  falha(erroBanco(error) === "turno_fechado" ? ERRO_FECHADO : ERRO_GENERICO);

const TOKEN_FORMATO = /^[A-Za-z0-9_-]{43}$/;

/** Resolve o id/status do turno do token; nunca confia em ids vindos do cliente. */
async function resolverTurno(token: string): Promise<{ id: string; status: StatusTurno } | null> {
  if (typeof token !== "string" || !TOKEN_FORMATO.test(token)) return null;
  const { data, error } = await criarClienteAdmin()
    .from("turnos")
    .select("id, status")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error) {
    console.error("resolverTurno:", error.message);
    throw new Error("resolverTurno");
  }
  return data ? (data as { id: string; status: StatusTurno }) : null;
}

/** Turno do token aberto para lançamentos (em_campo ou enviado). */
export async function turnoAberto(token: string): Promise<Resultado<{ id: string; status: StatusTurno }>> {
  const t = await resolverTurno(token);
  if (!t) return falha(ERRO_LINK);
  if (t.status !== "em_campo" && t.status !== "enviado") return falha(ERRO_FECHADO);
  return ok(t);
}

export async function obterTurnoPorToken(token: string): Promise<TurnoCompleto | null> {
  const t = await resolverTurno(token);
  if (!t) return null;
  return obterTurnoCompleto(criarClienteAdmin(), t.id);
}

/** Funções do menu do efetivo para o turno já resolvido pelo token (escopo: a obra do próprio turno). */
export async function opcoesFuncaoCampo(turno: Pick<TurnoCompleto, "obra_id" | "data" | "periodo">): Promise<string[]> {
  return opcoesFuncaoDoTurno(criarClienteAdmin(), turno.obra_id, turno.data, turno.periodo);
}

/**
 * Responsáveis com atividade ou efetivo no turno, ou com atividade programada na semana do turno
 * (mesmo período), em ordem alfabética (para "Quem é você?").
 */
export async function responsaveisDoTurno(
  turno: Pick<TurnoCompleto, "obra_id" | "data" | "periodo" | "atividades" | "efetivo">,
): Promise<ResponsavelRef[]> {
  const admin = criarClienteAdmin();
  const daSemana: (string | null)[] = [];
  const semana = await semanaDoTurno(admin, turno.obra_id, turno.data);
  if (semana && semana.status === "programada") {
    const { data: pa, error: ep } = await admin
      .from("programacao_atividades")
      .select("responsavel_id")
      .eq("semana_id", semana.id)
      .eq("periodo", turno.periodo);
    if (ep) {
      console.error("responsaveisDoTurno (semana):", ep.message);
      throw new Error("responsaveisDoTurno");
    }
    daSemana.push(...(pa ?? []).map((r) => (r.responsavel_id as string | null) ?? null));
  }
  const ids = [...new Set([...turno.atividades.map((a) => a.responsavel_id), ...turno.efetivo.map((e) => e.responsavel_id), ...daSemana])]
    .filter((x): x is string => x !== null);
  if (ids.length === 0) return [];
  const { data, error } = await admin
    .from("responsaveis")
    .select("id, nome, ativo")
    .eq("obra_id", turno.obra_id)
    .in("id", ids);
  if (error) {
    console.error("responsaveisDoTurno:", error.message);
    throw new Error("responsaveisDoTurno");
  }
  return ((data ?? []) as ResponsavelRef[]).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * `responsavelId` (escolhido no link): só aceita atividade dessa equipe e grava `lancado_por_id`.
 * null ("Ver tudo" / turno sem responsáveis): só atividade sem responsável.
 */
export async function salvarExecucao(
  token: string,
  atividadeId: string,
  dados: DadosExecucao,
  esperado: ValoresExecucao,
  responsavelId: string | null = null,
): Promise<Resultado<ValoresExecucao>> {
  const v = validarExecucao(dados);
  if (!v.ok) return v;
  const e = validarExecucao(esperado);
  if (!e.ok) return e;

  const t = await turnoAberto(token);
  if (!t.ok) return t;
  const admin = criarClienteAdmin();

  const { data: at, error: ea } = await admin
    .from("atividades")
    .select("id, qtd_planejada, responsavel_id, tipo, programacao_atividade_id")
    .eq("id", atividadeId)
    .eq("turno_id", t.dados.id)
    .maybeSingle();
  if (ea && ea.code !== "22P02") {
    console.error("salvarExecucao (leitura):", ea.message);
    return falha(ERRO_GENERICO);
  }
  if (!at) return falha(ERRO_ATIVIDADE);
  if ((at.responsavel_id ?? null) !== responsavelId) return falha(ERRO_ATIVIDADE);

  // Extra não tem meta: o banco iguala o planejado ao executado.
  const concluida = at.tipo === "extra" || statusAtividade(Number(at.qtd_planejada), dados.qtd_realizada) === "concluida";
  const campos = camposExecucao(concluida, dados);
  let gravar = admin
    .from("atividades")
    .update({ ...campos, lancado_por_id: responsavelId, lancado_em: new Date().toISOString() })
    .eq("id", atividadeId)
    .eq("turno_id", t.dados.id);
  // Troca de responsável entre a leitura e a gravação: não grava na equipe de outro.
  gravar = responsavelId !== null ? gravar.eq("responsavel_id", responsavelId) : gravar.is("responsavel_id", null);
  // Checagem otimista: aba/tela desatualizada não sobrescreve o que foi gravado em outro lugar.
  const { data, error } = await filtrarEsperado(gravar, esperado).select("id");
  if (error) {
    if (erroBanco(error) === "extra_sem_quantidade") return falha(ERRO_EXTRA_SEM_QTD);
    console.error("salvarExecucao:", error.message);
    return erroGravacao(error);
  }
  if (!data || data.length === 0) {
    const { data: atual } = await admin
      .from("atividades")
      .select("qtd_realizada, causa, observacao, responsavel_id")
      .eq("id", atividadeId)
      .eq("turno_id", t.dados.id)
      .maybeSingle();
    if (!atual || (atual.responsavel_id ?? null) !== responsavelId) return falha(ERRO_ATIVIDADE);
    return conflitoOuJaGravado(lerValores(atual), campos);
  }
  if (at.programacao_atividade_id) {
    await reajustarCopiasFuturas(admin, at.programacao_atividade_id as string, t.dados.id, at.tipo === "adiantada");
  }
  return ok(campos);
}

// ---- Fora do dia pelo link (adiantar, atrasada, extra): sempre com o responsável escolhido ----

/** Opções de adiantar/atrasada do responsável no turno do token (já resolvido). */
export async function opcoesPuxarCampo(
  turno: Pick<TurnoCompleto, "id" | "obra_id" | "data" | "periodo">,
  responsavelId: string,
): Promise<OpcoesPuxar> {
  if (!responsavelId) return SEM_OPCOES;
  return opcoesDoTurno(criarClienteAdmin(), turno, responsavelId);
}

export async function puxarCampo(token: string, programacaoAtividadeId: string, modo: ModoPuxar, responsavelId: string): Promise<Resultado> {
  if (typeof responsavelId !== "string" || !responsavelId) return falha(ERRO_RESPONSAVEL_INVALIDO);
  const t = await turnoAberto(token);
  if (!t.ok) return t;
  return puxarDaSemana(criarClienteAdmin(), t.dados.id, programacaoAtividadeId, modo, responsavelId, responsavelId, ERRO_FECHADO);
}

/** O extra do campo é sempre da equipe de quem lançou. */
export async function lancarExtraCampo(token: string, dados: unknown, responsavelId: string): Promise<Resultado<{ id: string }>> {
  if (typeof responsavelId !== "string" || !responsavelId) return falha(ERRO_RESPONSAVEL_INVALIDO);
  const t = await turnoAberto(token);
  if (!t.ok) return t;
  const entrada = { ...((dados ?? {}) as Record<string, unknown>), responsavel_id: responsavelId };
  return lancarExtra(criarClienteAdmin(), t.dados.id, entrada, responsavelId, ERRO_FECHADO);
}

export async function removerForaDoDiaCampo(token: string, atividadeId: string, responsavelId: string): Promise<Resultado> {
  if (typeof responsavelId !== "string" || !responsavelId) return falha(ERRO_RESPONSAVEL_INVALIDO);
  const t = await turnoAberto(token);
  if (!t.ok) return t;
  return removerForaDoDia(criarClienteAdmin(), t.dados.id, atividadeId, responsavelId, ERRO_FECHADO);
}

/**
 * Substitui o efetivo do turno de forma atômica. `esperado` é o efetivo que o cliente leu/salvou
 * por último: se o banco tiver outro, ninguém sobrescreve ninguém (efetivo_conflito, sem repetir).
 */
export async function salvarEfetivo(
  token: string,
  linhas: LinhaEfetivo[],
  esperado: LinhaEfetivo[],
  responsavelId: string | null = null,
): Promise<Resultado> {
  const e = validarEfetivoEsperado(esperado);
  if (!e.ok) return e;
  const v = validarEfetivo(linhas, e.dados);
  if (!v.ok) return v;

  const t = await turnoAberto(token);
  if (!t.ok) return t;
  const { error } = await criarClienteAdmin().rpc("substituir_efetivo", {
    p_turno_id: t.dados.id,
    p_responsavel_id: responsavelId,
    p_esperado: e.dados,
    p_linhas: v.dados,
  });
  if (error) {
    if (erroBanco(error) === "efetivo_conflito") return falhaConflito(ERRO_EFETIVO_CONFLITO);
    if (erroBanco(error) === "responsavel_invalido" || error.code === "22P02") return falha(ERRO_RESPONSAVEL_INVALIDO);
    console.error("salvarEfetivo:", error.message);
    return erroGravacao(error);
  }
  return ok(undefined);
}

/** Só no turno sem responsáveis (fluxo antigo, horário digitado). Com responsáveis, o horário sai do Iniciar/Terminei. */
export async function salvarHorarioReal(
  token: string,
  dados: { hora_inicio_real: string | null; hora_fim_real: string | null },
): Promise<Resultado> {
  const v = validarHorario(dados);
  if (!v.ok) return v;
  const t = await turnoAberto(token);
  if (!t.ok) return t;
  const admin = criarClienteAdmin();
  const { data: comDono, error: ed } = await admin
    .from("atividades")
    .select("id")
    .eq("turno_id", t.dados.id)
    .not("responsavel_id", "is", null)
    .limit(1);
  if (ed) {
    console.error("salvarHorarioReal:", ed.message);
    return falha(ERRO_GENERICO);
  }
  if ((comDono ?? []).length > 0) return falha(ERRO_HORARIO_POR_INICIAR);
  const { error } = await admin
    .from("turnos")
    .update({ hora_inicio_real: dados.hora_inicio_real, hora_fim_real: dados.hora_fim_real })
    .eq("id", t.dados.id);
  if (error) {
    console.error("salvarHorarioReal:", error.message);
    return erroGravacao(error);
  }
  return ok(undefined);
}

export async function enviarTurnoCampo(token: string): Promise<Resultado<{ status: StatusTurno }>> {
  const t = await turnoAberto(token);
  if (!t.ok) return t;
  if (t.dados.status === "enviado") return ok({ status: "enviado" });
  // Com responsáveis, o envio é pelo "Terminei minha parte" de todos (terminados.ts).
  const { data: comDono, error: ed } = await criarClienteAdmin()
    .from("atividades")
    .select("id")
    .eq("turno_id", t.dados.id)
    .not("responsavel_id", "is", null)
    .limit(1);
  if (ed) {
    console.error("enviarTurnoCampo:", ed.message);
    return falha(ERRO_GENERICO);
  }
  if ((comDono ?? []).length > 0) return falha(ERRO_ENVIO_POR_TERMINEI);
  const r = await aplicarAcao(criarClienteAdmin(), t.dados.id, "enviar");
  if (!r.ok) return r;
  return ok({ status: r.dados.status });
}
