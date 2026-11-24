import type { SupabaseClient } from "@supabase/supabase-js";
import { statusAtividade } from "@/lib/dominio/calculos";
import type { Janela } from "@/lib/dominio/efetivoHH";
import type { Periodo, PeriodoClima, StatusTurno } from "@/lib/dominio/tipos";
import type { ValoresExecucao } from "@/lib/dominio/conflito";
import {
  ERRO_EFETIVO_CONFLITO,
  ERRO_EXECUCAO_CONFLITO,
  ERRO_EXTRA_SEM_QTD,
  ERRO_FECHADO_PLANEJADOR,
  ERRO_RESPONSAVEL_INVALIDO,
  erroBanco,
} from "./mensagens";
import { reajustarCopiasFuturas } from "./foraDoDia";
import { falha, falhaConflito, ok, type Resultado } from "./resultado";
import {
  camposExecucao,
  validarClima,
  validarEfetivo,
  validarEfetivoEsperado,
  validarExecucao,
  validarHorario,
  validarIntervalo,
  validarPeriodoClima,
  type DadosClima,
  type DadosExecucao,
  type DadosHorario,
  type LinhaEfetivo,
} from "./validacao";

/**
 * Correções do planejador sobre a execução. Usam o cliente da SESSÃO (RLS), nunca o admin,
 * e recusam turno fechado. Mesmas validações do encarregado (validacao.ts).
 */

const ERRO_FECHADO = ERRO_FECHADO_PLANEJADOR;
const ERRO_GENERICO = "Não foi possível salvar. Tente novamente.";

/** Turno fechado entre a checagem e a gravação (trigger do banco) vira a mensagem do planejador. */
const erroGravacao = (error: { code?: string; message?: string }) =>
  falha(erroBanco(error) === "turno_fechado" ? ERRO_FECHADO : ERRO_GENERICO);

export async function turnoAbertoParaCorrecao(c: SupabaseClient, turnoId: string): Promise<Resultado> {
  const { data, error } = await c.from("turnos").select("status").eq("id", turnoId).maybeSingle();
  if (error && error.code !== "22P02") {
    console.error("turnoAbertoParaCorrecao:", error.message);
    return falha(ERRO_GENERICO);
  }
  if (!data) return falha("Turno não encontrado");
  const status = (data as { status: StatusTurno }).status;
  if (status === "fechado") return falha(ERRO_FECHADO);
  return ok(undefined);
}

/** Filtros da checagem otimista: só grava se a linha ainda tiver os valores que a tela viu. */
export function filtrarEsperado<Q extends { eq(c: string, v: unknown): Q; is(c: string, v: null): Q }>(
  q: Q,
  e: ValoresExecucao,
): Q {
  let r = q;
  for (const col of ["qtd_realizada", "causa", "observacao"] as const) {
    const v = e[col];
    r = v === null ? r.is(col, null) : r.eq(col, v);
  }
  return r;
}

/** Valores da execução como estão no banco (numeric chega como string ou número). */
export function lerValores(linha: { qtd_realizada: unknown; causa: unknown; observacao: unknown }): ValoresExecucao {
  return {
    qtd_realizada: linha.qtd_realizada === null ? null : Number(linha.qtd_realizada),
    causa: (linha.causa as ValoresExecucao["causa"]) ?? null,
    observacao: (linha.observacao as string | null) ?? null,
  };
}

/**
 * Nada gravado porque o banco não confere com o `esperado`. Se o banco já tem exatamente o que
 * esta gravação queria (repetição após resposta perdida na rede, ou o mesmo valor vindo de outra
 * aba), é sucesso; senão, conflito com os valores atuais.
 */
export function conflitoOuJaGravado(atual: ValoresExecucao, campos: ValoresExecucao): Resultado<ValoresExecucao> {
  const igual = atual.qtd_realizada === campos.qtd_realizada && atual.causa === campos.causa && atual.observacao === campos.observacao;
  return igual ? ok(atual) : falhaConflito(ERRO_EXECUCAO_CONFLITO, atual);
}

/**
 * `esperado`: a execução como a tela a viu/gravou por último. Se o banco tiver outra (outra aba,
 * outra pessoa), não grava e devolve o conflito com os valores atuais. Sucesso devolve o gravado.
 */
export async function salvarExecucaoPlanejador(
  c: SupabaseClient,
  turnoId: string,
  atividadeId: string,
  dados: DadosExecucao,
  esperado: ValoresExecucao,
): Promise<Resultado<ValoresExecucao>> {
  const v = validarExecucao(dados);
  if (!v.ok) return v;
  const e = validarExecucao(esperado);
  if (!e.ok) return e;
  const t = await turnoAbertoParaCorrecao(c, turnoId);
  if (!t.ok) return t;

  const { data: at, error: ea } = await c
    .from("atividades")
    .select("id, qtd_planejada, tipo, programacao_atividade_id")
    .eq("id", atividadeId)
    .eq("turno_id", turnoId)
    .maybeSingle();
  if (ea && ea.code !== "22P02") {
    console.error("salvarExecucaoPlanejador (leitura):", ea.message);
    return falha(ERRO_GENERICO);
  }
  if (!at) return falha("Atividade não encontrada");

  const concluida = at.tipo === "extra" || statusAtividade(Number(at.qtd_planejada), dados.qtd_realizada) === "concluida";
  const campos = camposExecucao(concluida, dados);
  const { data, error } = await filtrarEsperado(
    c.from("atividades").update({ ...campos, lancado_por_id: null, lancado_em: new Date().toISOString() }).eq("id", atividadeId).eq("turno_id", turnoId),
    esperado,
  ).select("id");
  if (error) {
    if (erroBanco(error) === "extra_sem_quantidade") return falha(ERRO_EXTRA_SEM_QTD);
    console.error("salvarExecucaoPlanejador:", error.message);
    return erroGravacao(error);
  }
  if (!data || data.length === 0) {
    const { data: atual } = await c
      .from("atividades")
      .select("qtd_realizada, causa, observacao")
      .eq("id", atividadeId)
      .eq("turno_id", turnoId)
      .maybeSingle();
    if (!atual) return falha("Atividade não encontrada");
    return conflitoOuJaGravado(lerValores(atual), campos);
  }
  if (at.tipo === "adiantada" && at.programacao_atividade_id) {
    await reajustarCopiasFuturas(c, at.programacao_atividade_id as string, turnoId);
  }
  return ok(campos);
}

/** Substituição atômica com checagem otimista (ver salvarEfetivo em campo.ts). */
export async function salvarEfetivoPlanejador(
  c: SupabaseClient,
  turnoId: string,
  responsavelId: string | null,
  linhas: LinhaEfetivo[],
  esperado: LinhaEfetivo[],
): Promise<Resultado> {
  const e = validarEfetivoEsperado(esperado);
  if (!e.ok) return e;
  const v = validarEfetivo(linhas, e.dados);
  if (!v.ok) return v;
  const t = await turnoAbertoParaCorrecao(c, turnoId);
  if (!t.ok) return t;
  const { error } = await c.rpc("substituir_efetivo", {
    p_turno_id: turnoId,
    p_responsavel_id: responsavelId,
    p_esperado: e.dados,
    p_linhas: v.dados,
    p_pelo_planejador: true,
  });
  if (error) {
    if (erroBanco(error) === "efetivo_conflito") return falhaConflito(ERRO_EFETIVO_CONFLITO);
    if (erroBanco(error) === "responsavel_invalido" || error.code === "22P02") return falha(ERRO_RESPONSAVEL_INVALIDO);
    console.error("salvarEfetivoPlanejador:", error.message);
    return erroGravacao(error);
  }
  return ok(undefined);
}

export async function salvarClimaPlanejador(c: SupabaseClient, turnoId: string, dados: DadosClima): Promise<Resultado> {
  const v = validarClima(dados);
  if (!v.ok) return v;
  const t = await turnoAbertoParaCorrecao(c, turnoId);
  if (!t.ok) return t;
  const { error } = await c
    .from("clima")
    .upsert(
      { turno_id: turnoId, periodo: dados.periodo, condicao: dados.condicao, impediu: dados.impediu === true },
      { onConflict: "turno_id,periodo" },
    );
  if (error) {
    console.error("salvarClimaPlanejador:", error.message);
    return erroGravacao(error);
  }
  return ok(undefined);
}

export async function removerClimaPlanejador(c: SupabaseClient, turnoId: string, periodo: PeriodoClima): Promise<Resultado> {
  const v = validarPeriodoClima(periodo);
  if (!v.ok) return v;
  const t = await turnoAbertoParaCorrecao(c, turnoId);
  if (!t.ok) return t;
  const { error } = await c.from("clima").delete().eq("turno_id", turnoId).eq("periodo", periodo);
  if (error) {
    console.error("removerClimaPlanejador:", error.message);
    return erroGravacao(error);
  }
  return ok(undefined);
}

export async function salvarHorarioPlanejador(c: SupabaseClient, turnoId: string, dados: DadosHorario): Promise<Resultado> {
  const v = validarHorario(dados);
  if (!v.ok) return v;
  const t = await turnoAbertoParaCorrecao(c, turnoId);
  if (!t.ok) return t;
  const { data, error } = await c
    .from("turnos")
    .update({ hora_inicio_real: dados.hora_inicio_real, hora_fim_real: dados.hora_fim_real })
    .eq("id", turnoId)
    .select("id");
  if (error) {
    console.error("salvarHorarioPlanejador:", error.message);
    return erroGravacao(error);
  }
  if (!data || data.length === 0) return falha("Turno não encontrado");
  return ok(undefined);
}

/** Intervalo de refeição deste turno (null = sem intervalo). Não muda a obra nem outros turnos. */
export async function salvarIntervaloTurno(c: SupabaseClient, turnoId: string, j: Janela | null): Promise<Resultado> {
  const { data: t, error: et } = await c.from("turnos").select("periodo, status").eq("id", turnoId).maybeSingle();
  if (et && et.code !== "22P02") {
    console.error("salvarIntervaloTurno:", et.message);
    return falha(ERRO_GENERICO);
  }
  if (!t) return falha("Turno não encontrado");
  if ((t as { status: StatusTurno }).status === "fechado") return falha(ERRO_FECHADO);
  const v = validarIntervalo(j, (t as { periodo: Periodo }).periodo);
  if (!v.ok) return v;
  const { error } = await c
    .from("turnos")
    .update({ intervalo_inicio: v.dados?.inicio ?? null, intervalo_fim: v.dados?.fim ?? null })
    .eq("id", turnoId);
  if (error) return erroGravacao(error);
  return ok(undefined);
}
