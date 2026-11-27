import type { SupabaseClient } from "@supabase/supabase-js";
import {
  copiasParaAjustar,
  podeRemoverPlanejador,
  opcoesParaPuxar,
  SEM_OPCOES,
  validarExtra,
  type DadosExtra,
  type ModoPuxar,
  type OpcoesPuxar,
} from "@/lib/dominio/foraDoDia";
import type { Periodo, StatusTurno } from "@/lib/dominio/tipos";
import { ERRO_FECHADO_PLANEJADOR, ERRO_RESPONSAVEL_INVALIDO, erroBanco } from "./mensagens";
import { removerFoto } from "./fotosParada";
import { nomesResponsaveis, obterDadosSemana, semanaDoTurno } from "./programacao";
import { textoOrigemMeta } from "@/lib/dominio/sequencia";
import { lerMateriais } from "@/lib/dominio/extraApontamento";
import { falha, ok, type Resultado } from "./resultado";

/**
 * Atividades fora do dia (spec 2026-11-17): adiantar, continuar atrasada, serviço extra.
 * As funções recebem o cliente: o link de campo passa o admin já escopado ao turno do token
 * (campo.ts); o planejador passa o cliente da sessão (RLS).
 */

export const ERRO_INDISPONIVEL = "Esta atividade não está disponível. Recarregue a página.";
export const ERRO_ID_REUSADO = "Este registro já existe com outros dados. Recarregue a página.";
export const ERRO_NAO_SUA = "Só quem lançou pode remover. Fale com o planejador.";
const ERRO_GENERICO = "Não foi possível salvar. Tente novamente.";
const UNICIDADE = "23505";

type TurnoBase = { id: string; obra_id: string; data: string; periodo: Periodo; status: StatusTurno };

function traduzir(error: { code?: string; message?: string }, erroFechado: string): Resultado<never> {
  const b = erroBanco(error);
  if (b === "turno_fechado") return falha(erroFechado);
  if (b === "responsavel_invalido" || error.code === "22P02") return falha(ERRO_RESPONSAVEL_INVALIDO);
  if (b === "programacao_incompativel") return falha(ERRO_INDISPONIVEL);
  console.error("foraDoDia:", error.message);
  return falha(ERRO_GENERICO);
}

async function lerTurno(c: SupabaseClient, turnoId: string): Promise<TurnoBase | null> {
  const { data, error } = await c.from("turnos").select("id, obra_id, data, periodo, status").eq("id", turnoId).maybeSingle();
  if (error && error.code !== "22P02") console.error("foraDoDia (turno):", error.message);
  return (data as TurnoBase | null) ?? null;
}

async function proximaOrdem(c: SupabaseClient, turnoId: string): Promise<number | null> {
  const { data, error } = await c.from("atividades").select("ordem").eq("turno_id", turnoId);
  if (error) {
    console.error("foraDoDia (ordem):", error.message);
    return null;
  }
  return (data ?? []).reduce((m, r) => Math.max(m, Number(r.ordem)), -1) + 1;
}

/** Opções de adiantar/atrasada para o turno; `escopo` null = todas as equipes. */
export async function opcoesDoTurno(c: SupabaseClient, turno: Pick<TurnoBase, "id" | "obra_id" | "data" | "periodo">, escopo: string | null): Promise<OpcoesPuxar> {
  const semana = await semanaDoTurno(c, turno.obra_id, turno.data);
  if (!semana) return SEM_OPCOES;
  return opcoesParaPuxar(await obterDadosSemana(c, semana), turno, escopo);
}

/** Traz uma atividade da semana para o turno (adiantada ou atrasada). Repetir é sucesso. */
export async function puxarDaSemana(
  c: SupabaseClient,
  turnoId: string,
  programacaoAtividadeId: string,
  modo: ModoPuxar,
  criadaPorId: string | null,
  escopo: string | null,
  erroFechado: string,
): Promise<Resultado> {
  if (modo !== "adiantar" && modo !== "atrasada") return falha(ERRO_INDISPONIVEL);
  const turno = await lerTurno(c, turnoId);
  if (!turno) return falha("Turno não encontrado");
  if (turno.status === "fechado") return falha(erroFechado);
  const semana = await semanaDoTurno(c, turno.obra_id, turno.data);
  if (!semana) return falha(ERRO_INDISPONIVEL);
  const dados = await obterDadosSemana(c, semana);
  if (dados.execucoes.some((e) => e.turno_id === turnoId && e.programacao_atividade_id === programacaoAtividadeId)) return ok(undefined);
  const opcoes = opcoesParaPuxar(dados, turno, escopo);
  const opcao = (modo === "adiantar" ? opcoes.adiantar : opcoes.atrasadas).find((o) => o.programacaoAtividadeId === programacaoAtividadeId);
  const a = dados.atividades.find((x) => x.id === programacaoAtividadeId);
  if (!opcao || !a) return falha(ERRO_INDISPONIVEL);

  const ordem = await proximaOrdem(c, turnoId);
  if (ordem === null) return falha(ERRO_GENERICO);
  const { error } = await c.from("atividades").insert({
    turno_id: turnoId,
    ordem,
    descricao: a.descricao,
    local: a.local,
    unidade: a.unidade,
    qtd_planejada: opcao.saldo,
    programacao_atividade_id: a.id,
    responsavel_id: a.responsavel_id,
    criada_por_id: criadaPorId,
    tipo: modo === "adiantar" ? "adiantada" : null,
    puxada: true,
  });
  if (!error || error.code === UNICIDADE) return ok(undefined);
  return traduzir(error, erroFechado);
}

const mesmoExtra = (d: DadosExtra, turnoId: string, r: Record<string, unknown>) =>
  r.turno_id === turnoId &&
  r.tipo === "extra" &&
  r.descricao === d.descricao &&
  r.unidade === d.unidade &&
  Number(r.qtd_realizada) === d.qtd &&
  ((r.observacao as string | null) ?? null) === d.observacao &&
  ((r.solicitado_por as string | null) ?? null) === d.solicitado_por &&
  (r.extra_pessoas === null || r.extra_pessoas === undefined ? null : Number(r.extra_pessoas)) === d.extra_pessoas &&
  (r.extra_horas === null || r.extra_horas === undefined ? null : Number(r.extra_horas)) === d.extra_horas &&
  JSON.stringify(lerMateriais(r.materiais)) === JSON.stringify(d.materiais) &&
  ((r.responsavel_id as string | null) ?? null) === d.responsavel_id;

/** Serviço extra com id do cliente: reenviar o mesmo registro não duplica. */
export async function lancarExtra(
  c: SupabaseClient,
  turnoId: string,
  entrada: unknown,
  criadaPorId: string | null,
  erroFechado: string,
): Promise<Resultado<{ id: string }>> {
  const v = validarExtra(entrada);
  if (!v.ok) return v;
  const d = v.dados;
  const jaGravado = async (): Promise<Resultado<{ id: string }> | null> => {
    const { data } = await c.from("atividades").select("*").eq("id", d.id).maybeSingle();
    if (!data) return null;
    return mesmoExtra(d, turnoId, data) ? ok({ id: d.id }) : falha(ERRO_ID_REUSADO);
  };
  const antes = await jaGravado();
  if (antes) return antes;

  const ordem = await proximaOrdem(c, turnoId);
  if (ordem === null) return falha(ERRO_GENERICO);
  const { error } = await c.from("atividades").insert({
    id: d.id,
    turno_id: turnoId,
    ordem,
    descricao: d.descricao,
    unidade: d.unidade,
    qtd_planejada: d.qtd,
    qtd_realizada: d.qtd,
    observacao: d.observacao,
    responsavel_id: d.responsavel_id,
    criada_por_id: criadaPorId,
    tipo: "extra",
    equipe: d.equipe,
    solicitado_por: d.solicitado_por,
    extra_pessoas: d.extra_pessoas,
    extra_horas: d.extra_horas,
    materiais: d.materiais,
  });
  if (!error) return ok({ id: d.id });
  if (error.code === UNICIDADE) return (await jaGravado()) ?? falha(ERRO_ID_REUSADO);
  return traduzir(error, erroFechado);
}

/** Remove extra/adiantada/atrasada criada fora do planejamento. `criadaPorId` não nulo: só a própria. */
export async function removerForaDoDia(
  c: SupabaseClient,
  turnoId: string,
  atividadeId: string,
  criadaPorId: string | null,
  erroFechado: string,
): Promise<Resultado> {
  const { data: at, error: ea } = await c
    .from("atividades")
    .select("id, tipo, criada_por_id, foto_path, puxada")
    .eq("id", atividadeId)
    .eq("turno_id", turnoId)
    .maybeSingle();
  if (ea && ea.code !== "22P02") return traduzir(ea, erroFechado);
  if (!at) return ok(undefined);
  if (criadaPorId !== null ? at.criada_por_id !== criadaPorId : !podeRemoverPlanejador(at)) return falha(ERRO_NAO_SUA);
  const { error } = await c.from("atividades").delete().eq("id", atividadeId).eq("turno_id", turnoId);
  if (error) return traduzir(error, erroFechado);
  if (at.foto_path) await removerFoto(at.foto_path as string);
  return ok(undefined);
}

/**
 * Depois de execução numa adiantada (ou em qualquer turno de uma sequência, item 19): ajusta/remove cópias
 * em turnos futuros ainda planejados. Melhor esforço.
 */
export async function reajustarCopiasFuturas(
  c: SupabaseClient,
  programacaoAtividadeId: string,
  turnoId: string,
  adiantada = true,
): Promise<void> {
  try {
    const turno = await lerTurno(c, turnoId);
    if (!turno) return;
    const semana = await semanaDoTurno(c, turno.obra_id, turno.data);
    if (!semana) return;
    const dados = await obterDadosSemana(c, semana);
    const ajustes = copiasParaAjustar(dados, programacaoAtividadeId, turno, adiantada);
    if (ajustes.length === 0) return;
    const nomes = await nomesResponsaveis(c, turno.obra_id);
    for (const x of ajustes) {
      const a = dados.atividades.find((p) => p.id === dados.execucoes.find((e) => e.id === x.atividadeId)?.programacao_atividade_id);
      const meta_origem = textoOrigemMeta(x.origem, a?.unidade ?? null, nomes.get(x.origem.anterior?.responsavel_id ?? "") ?? null);
      const q = x.nova === null
        ? c.from("atividades").delete().eq("id", x.atividadeId).is("qtd_realizada", null)
        : c.from("atividades").update({ qtd_planejada: x.nova, meta_origem }).eq("id", x.atividadeId).is("qtd_realizada", null);
      const { error } = await q;
      if (error) console.error("reajustarCopiasFuturas:", error.message);
    }
  } catch (e) {
    console.error("reajustarCopiasFuturas:", e);
  }
}

// ---- Planejador (cliente da sessão, RLS) ----

export async function opcoesPuxarPlanejador(c: SupabaseClient, turnoId: string): Promise<OpcoesPuxar> {
  const turno = await lerTurno(c, turnoId);
  return turno ? opcoesDoTurno(c, turno, null) : SEM_OPCOES;
}

export function puxarPlanejador(c: SupabaseClient, turnoId: string, programacaoAtividadeId: string, modo: ModoPuxar): Promise<Resultado> {
  return puxarDaSemana(c, turnoId, programacaoAtividadeId, modo, null, null, ERRO_FECHADO_PLANEJADOR);
}

export async function lancarExtraPlanejador(c: SupabaseClient, turnoId: string, entrada: unknown): Promise<Resultado<{ id: string }>> {
  const turno = await lerTurno(c, turnoId);
  if (!turno) return falha("Turno não encontrado");
  if (turno.status === "fechado") return falha(ERRO_FECHADO_PLANEJADOR);
  return lancarExtra(c, turnoId, entrada, null, ERRO_FECHADO_PLANEJADOR);
}

export function removerForaDoDiaPlanejador(c: SupabaseClient, turnoId: string, atividadeId: string) {
  return removerForaDoDia(c, turnoId, atividadeId, null, ERRO_FECHADO_PLANEJADOR);
}
