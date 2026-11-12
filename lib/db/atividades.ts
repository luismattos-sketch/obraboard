import type { SupabaseClient } from "@supabase/supabase-js";
import { saldoPendente, statusAtividade } from "@/lib/dominio/calculos";
import { compararTurnos } from "@/lib/dominio/regras";
import type { AtividadeExec, Causa } from "@/lib/dominio/tipos";
import { ERRO_FECHADO_PLANEJADOR, ERRO_RESPONSAVEL_INVALIDO, erroBanco } from "./mensagens";
import { falha, ok, type Resultado } from "./resultado";
import { COLUNAS_TURNO, type Turno } from "./turnos";
import { causaValida, errosDeTamanho, falhaCampos, LIMITES, QTD_PLANEJADA_MAX } from "./validacao";

export type Atividade = AtividadeExec & {
  turno_id: string;
  ordem: number;
  local: string | null;
  unidade: string;
  origem_id: string | null;
  /** Ligação com a atividade da programação semanal; null = avulsa (extra, se a semana estiver programada). */
  programacao_atividade_id: string | null;
  /** Quem assume a atividade no turno (null = "Sem responsável"). */
  responsavel_id: string | null;
  /** Quem salvou a execução pelo link de campo por último (null = "Ver tudo" ou planejador). */
  lancado_por_id: string | null;
};

const COLUNAS =
  "id, turno_id, ordem, descricao, local, unidade, qtd_planejada, qtd_realizada, causa, observacao, origem_id, programacao_atividade_id, responsavel_id, lancado_por_id";
const ERRO_FECHADO = ERRO_FECHADO_PLANEJADOR;
const UNICIDADE = "23505";
const ERRO_QTD_MAX = "Quantidade deve ser no máximo 1.000.000.000";

/** Erro do banco: turno fechado (trigger) vira a mensagem do planejador; o resto, a mensagem padrão. */
function erroGravacao(error: { code?: string; message?: string }, padrao: string): Resultado<never> {
  return falha(erroBanco(error) === "turno_fechado" ? ERRO_FECHADO : padrao);
}

function validarPlanejamento(d: { descricao?: string; local?: string | null; unidade?: string; qtd_planejada?: number }) {
  if (d.qtd_planejada !== undefined && d.qtd_planejada > QTD_PLANEJADA_MAX) {
    return falha(ERRO_QTD_MAX, { qtd_planejada: ERRO_QTD_MAX });
  }
  return falhaCampos(
    errosDeTamanho({
      descricao: { valor: d.descricao, max: LIMITES.descricao },
      local: { valor: d.local, max: LIMITES.local },
      unidade: { valor: d.unidade, max: LIMITES.unidade },
    }),
  );
}

export function normalizarAtividade(r: Record<string, unknown>): Atividade {
  return {
    id: r.id as string,
    turno_id: r.turno_id as string,
    ordem: Number(r.ordem),
    descricao: r.descricao as string,
    local: (r.local as string | null) ?? null,
    unidade: (r.unidade as string | null) ?? "",
    qtd_planejada: Number(r.qtd_planejada),
    qtd_realizada: r.qtd_realizada === null || r.qtd_realizada === undefined ? null : Number(r.qtd_realizada),
    causa: (r.causa as Causa | null) ?? null,
    observacao: (r.observacao as string | null) ?? null,
    origem_id: (r.origem_id as string | null) ?? null,
    programacao_atividade_id: (r.programacao_atividade_id as string | null) ?? null,
    responsavel_id: (r.responsavel_id as string | null) ?? null,
    lancado_por_id: (r.lancado_por_id as string | null) ?? null,
  };
}

const vazioParaNull = (s: string | null | undefined) => (s?.trim() ? s.trim() : null);

/** Lê o turno (via RLS) e confirma que existe e não está fechado. */
export async function turnoEditavel(c: SupabaseClient, turnoId: string): Promise<Resultado<Turno>> {
  const { data, error } = await c.from("turnos").select(COLUNAS_TURNO).eq("id", turnoId).maybeSingle();
  if (error || !data) {
    if (error && error.code !== "22P02") console.error("turnoEditavel:", error.message);
    return falha("Turno não encontrado");
  }
  if ((data as Turno).status === "fechado") return falha(ERRO_FECHADO);
  return ok(data as Turno);
}

async function atividadeEditavel(c: SupabaseClient, atividadeId: string): Promise<Resultado<Atividade>> {
  const { data, error } = await c.from("atividades").select(COLUNAS).eq("id", atividadeId).maybeSingle();
  if (error || !data) {
    if (error && error.code !== "22P02") console.error("atividadeEditavel:", error.message);
    return falha("Atividade não encontrada");
  }
  const at = normalizarAtividade(data);
  const t = await turnoEditavel(c, at.turno_id);
  if (!t.ok) return t;
  return ok(at);
}

export async function adicionarAtividade(
  c: SupabaseClient,
  turnoId: string,
  dados: { descricao: string; local?: string | null; unidade: string; qtd_planejada: number },
): Promise<Resultado<Atividade>> {
  const descricao = dados.descricao.trim();
  const unidade = dados.unidade.trim();
  if (!descricao) return falha("Informe a descrição");
  if (!unidade) return falha("Informe a unidade");
  if (!(dados.qtd_planejada > 0)) return falha("Quantidade deve ser maior que zero");
  const tamanho = validarPlanejamento(dados);
  if (tamanho) return tamanho;
  const t = await turnoEditavel(c, turnoId);
  if (!t.ok) return t;

  const { data: ult, error: eo } = await c
    .from("atividades")
    .select("ordem")
    .eq("turno_id", turnoId)
    .order("ordem", { ascending: false })
    .limit(1);
  if (eo) {
    console.error("adicionarAtividade (ordem):", eo.message);
    return falha("Não foi possível adicionar a atividade.");
  }
  const ordem = ult && ult.length > 0 ? Number(ult[0].ordem) + 1 : 0;

  const { data, error } = await c
    .from("atividades")
    .insert({
      turno_id: turnoId,
      ordem,
      descricao,
      local: vazioParaNull(dados.local),
      unidade,
      qtd_planejada: dados.qtd_planejada,
    })
    .select(COLUNAS)
    .single();
  if (error || !data) {
    console.error("adicionarAtividade:", error?.message);
    return error ? erroGravacao(error, "Não foi possível adicionar a atividade.") : falha("Não foi possível adicionar a atividade.");
  }
  return ok(normalizarAtividade(data));
}

export type CamposEditaveis = Partial<
  Pick<Atividade, "descricao" | "local" | "unidade" | "qtd_planejada" | "qtd_realizada" | "causa" | "observacao">
>;

/** Troca o responsável da atividade (turno não fechado; o banco confere que é da mesma obra). */
export async function definirResponsavel(
  c: SupabaseClient,
  atividadeId: string,
  responsavelId: string | null,
): Promise<Resultado> {
  const a = await atividadeEditavel(c, atividadeId);
  if (!a.ok) return a;
  const { error } = await c.from("atividades").update({ responsavel_id: responsavelId }).eq("id", atividadeId);
  if (error) {
    if (erroBanco(error) === "responsavel_invalido" || error.code === "22P02") return falha(ERRO_RESPONSAVEL_INVALIDO);
    console.error("definirResponsavel:", error.message);
    return erroGravacao(error, "Não foi possível trocar o responsável.");
  }
  return ok(undefined);
}

export async function editarAtividade(
  c: SupabaseClient,
  atividadeId: string,
  campos: CamposEditaveis,
): Promise<Resultado> {
  // Whitelist: nunca repassar o objeto recebido (ex.: origem_id, turno_id, ordem).
  const upd: Record<string, unknown> = {};
  if (campos.descricao !== undefined) {
    if (!campos.descricao.trim()) return falha("Informe a descrição");
    upd.descricao = campos.descricao.trim();
  }
  if (campos.unidade !== undefined) {
    if (!campos.unidade.trim()) return falha("Informe a unidade");
    upd.unidade = campos.unidade.trim();
  }
  if (campos.local !== undefined) upd.local = vazioParaNull(campos.local);
  if (campos.qtd_planejada !== undefined) {
    if (!(campos.qtd_planejada > 0)) return falha("Quantidade deve ser maior que zero");
    upd.qtd_planejada = campos.qtd_planejada;
  }
  if (campos.qtd_realizada !== undefined) {
    if (campos.qtd_realizada !== null && !(campos.qtd_realizada >= 0)) return falha("Quantidade realizada inválida");
    upd.qtd_realizada = campos.qtd_realizada;
  }
  if (campos.causa !== undefined) {
    if (campos.causa !== null && !causaValida(campos.causa)) return falha("Causa inválida");
    upd.causa = campos.causa;
  }
  if (campos.observacao !== undefined) upd.observacao = vazioParaNull(campos.observacao);
  const tamanho = validarPlanejamento(campos);
  if (tamanho) return tamanho;
  if (Object.keys(upd).length === 0) return ok(undefined);

  const a = await atividadeEditavel(c, atividadeId);
  if (!a.ok) return a;
  const { error } = await c.from("atividades").update(upd).eq("id", atividadeId);
  if (error) {
    console.error("editarAtividade:", error.message);
    return erroGravacao(error, "Não foi possível salvar a atividade.");
  }
  return ok(undefined);
}

export async function removerAtividade(c: SupabaseClient, atividadeId: string): Promise<Resultado> {
  const a = await atividadeEditavel(c, atividadeId);
  if (!a.ok) return a;
  const { error } = await c.from("atividades").delete().eq("id", atividadeId);
  if (error) {
    console.error("removerAtividade:", error.message);
    return erroGravacao(error, "Não foi possível remover a atividade.");
  }
  return ok(undefined);
}

export async function moverAtividade(
  c: SupabaseClient,
  atividadeId: string,
  direcao: "cima" | "baixo",
): Promise<Resultado> {
  const a = await atividadeEditavel(c, atividadeId);
  if (!a.ok) return a;
  const { data, error } = await c
    .from("atividades")
    .select("id, ordem, responsavel_id")
    .eq("turno_id", a.dados.turno_id)
    .order("ordem")
    .order("created_at");
  if (error || !data) {
    console.error("moverAtividade:", error?.message);
    return falha("Não foi possível reordenar.");
  }
  const lista = data.map((r) => ({ id: r.id as string, ordem: Number(r.ordem), resp: (r.responsavel_id as string | null) ?? null }));
  const i = lista.findIndex((r) => r.id === atividadeId);
  if (i < 0) return ok(undefined);
  // A lista é exibida agrupada por responsável: troca com a vizinha mais próxima da MESMA equipe.
  const passo = direcao === "cima" ? -1 : 1;
  let j = i + passo;
  while (j >= 0 && j < lista.length && lista[j].resp !== lista[i].resp) j += passo;
  if (j < 0 || j >= lista.length) return ok(undefined);
  [lista[i], lista[j]] = [lista[j], lista[i]];
  // Renumera a lista inteira para 0..n-1 (corrige lacunas e duplicatas), gravando só o que mudou.
  for (let k = 0; k < lista.length; k++) {
    if (lista[k].ordem === k) continue;
    const { error: eu } = await c.from("atividades").update({ ordem: k }).eq("id", lista[k].id);
    if (eu) {
      console.error("moverAtividade (update):", eu.message);
      return erroGravacao(eu, "Não foi possível reordenar.");
    }
  }
  return ok(undefined);
}

export async function trazerPendentes(
  c: SupabaseClient,
  turnoId: string,
): Promise<Resultado<{ adicionadas: number }>> {
  const t = await turnoEditavel(c, turnoId);
  if (!t.ok) return t;
  const atual = t.dados;

  const { data: irmaos, error: et } = await c.from("turnos").select(COLUNAS_TURNO).eq("obra_id", atual.obra_id);
  if (et) {
    console.error("trazerPendentes (turnos):", et.message);
    return falha("Não foi possível trazer pendentes.");
  }
  const anterior = ((irmaos ?? []) as Turno[])
    .filter((x) => compararTurnos(x, atual) < 0)
    .sort((a, b) => compararTurnos(b, a))[0];
  if (!anterior) return falha("Não há turno anterior nesta obra");

  const { data: ant, error: ea } = await c
    .from("atividades")
    .select(COLUNAS)
    .eq("turno_id", anterior.id)
    .order("ordem")
    .order("created_at");
  const { data: nesse, error: en } = await c.from("atividades").select("origem_id, ordem").eq("turno_id", turnoId);
  if (ea || en) {
    console.error("trazerPendentes (atividades):", (ea ?? en)?.message);
    return falha("Não foi possível trazer pendentes.");
  }

  const jaTrazidas = new Set((nesse ?? []).map((r) => r.origem_id as string | null).filter(Boolean));
  let ordem = (nesse ?? []).reduce((m, r) => Math.max(m, Number(r.ordem)), -1) + 1;
  const novas = (ant ?? [])
    .map(normalizarAtividade)
    // Atividades da programação semanal não são copiadas: o saldo da meta já as leva aos próximos turnos.
    .filter((a) => a.programacao_atividade_id === null)
    .filter((a) => statusAtividade(a.qtd_planejada, a.qtd_realizada) !== "concluida" && !jaTrazidas.has(a.id))
    .map((a) => ({
      turno_id: turnoId,
      ordem: ordem++,
      descricao: a.descricao,
      local: a.local,
      unidade: a.unidade || null,
      qtd_planejada: saldoPendente(a.qtd_planejada, a.qtd_realizada),
      qtd_realizada: null,
      causa: null,
      observacao: null,
      origem_id: a.id,
      responsavel_id: a.responsavel_id,
    }));
  if (novas.length === 0) return ok({ adicionadas: 0 });

  const { error } = await c.from("atividades").insert(novas);
  if (!error) return ok({ adicionadas: novas.length });
  if (error.code !== UNICIDADE) {
    console.error("trazerPendentes (insert):", error.message);
    return erroGravacao(error, "Não foi possível trazer pendentes.");
  }
  // Corrida com outro "trazer pendentes": insere uma a uma e pula as já presentes (índice turno_id+origem_id).
  let adicionadas = 0;
  for (const nova of novas) {
    const { error: e1 } = await c.from("atividades").insert(nova);
    if (!e1) adicionadas++;
    else if (e1.code !== UNICIDADE) {
      console.error("trazerPendentes (insert 1 a 1):", e1.message);
      return erroGravacao(e1, "Não foi possível trazer pendentes.");
    }
  }
  return ok({ adicionadas });
}
