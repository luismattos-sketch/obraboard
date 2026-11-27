import type { SupabaseClient } from "@supabase/supabase-js";
import { inicioDaSemana, type SemanaProgramadaAnalise } from "@/lib/dominio/analise";
import { validarEquipe } from "@/lib/dominio/equipePrevista";
import { lerIniciados, lerOcorrencias, lerTerminados } from "@/lib/dominio/efetivoHH";
import { validarMotivo } from "@/lib/dominio/eventos";
import {
  dataDoDia,
  diaDaSemana,
  funcoesDaProgramacao,
  unirFuncoes,
  resumirSemana,
  rotuloTurnosAbertos,
  somarDias,
  type ResumoSemana,
  type AtividadeProgramada,
  type DadosSemana,
  type DiaSemana,
  type EquipePrevista,
  type ExecucaoLigada,
  type PpcSemanal,
  type Semana,
  type StatusSemana,
  type TurnoDaSemana,
} from "@/lib/dominio/programacao";
import { metaNoTurno, textoOrigemMeta, type MetaNoTurno } from "@/lib/dominio/sequencia";
import { saldoDaOrigem } from "@/lib/dominio/trazerSaldo";
import { FUNCOES_SUGERIDAS, type Causa, type Periodo, type TipoAtividade } from "@/lib/dominio/tipos";
import { turnoEditavel } from "./atividades";
import { erroBanco, ERRO_TRAZIDA_REPETIDA, MENSAGENS_PROGRAMACAO, mensagemProgramacao } from "./mensagens";
import { falha, ok, type Resultado } from "./resultado";
import { causaValida, errosDeTamanho, LIMITES, QTD_PLANEJADA_MAX } from "./validacao";

export type EntradaAtividadeProgramada = {
  descricao: string;
  local?: string | null;
  unidade?: string | null;
  meta: number;
  dias: DiaSemana[];
  periodo: Periodo;
  equipe: EquipePrevista[];
  responsavel_id?: string | null;
  /** Só na inclusão ("Continuar no próximo turno"). */
  continua_de?: string | null;
  /** Só na inclusão (item 1.6, "Trazer" da semana anterior). */
  trazida_de?: string | null;
  saldo_trazido?: number | null;
};

export const ERRO_DIAS_COM_EXECUCAO =
  "Esta atividade já foi executada em turnos fora desses dias ou período. Mantenha os dias e o período desses turnos.";

const COLUNAS_SEMANA = "id, obra_id, inicio, status, programada_em, encerrada_em, motivo_reabertura";
const UNICIDADE = "23505";
const UUID_INVALIDO = "22P02";
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const num = (v: unknown) => Number(v);
const numOuNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function obterSemana(c: SupabaseClient, obraId: string, inicio: string): Promise<Semana | null> {
  const { data, error } = await c
    .from("semanas")
    .select(COLUNAS_SEMANA)
    .eq("obra_id", obraId)
    .eq("inicio", inicio)
    .maybeSingle();
  if (error) {
    if (error.code === UUID_INVALIDO) return null;
    console.error("obterSemana:", error.message);
    throw new Error(`obterSemana: ${error.message}`);
  }
  return (data as Semana | null) ?? null;
}

/** Rascunho da semana que contém `data` (convertida para a segunda-feira). Idempotente. */
export async function criarRascunho(c: SupabaseClient, obraId: string, data: string): Promise<Resultado<Semana>> {
  if (typeof data !== "string" || !ISO.test(data) || Number.isNaN(Date.parse(`${data}T00:00:00Z`))) {
    return falha("Informe uma data válida");
  }
  const inicio = inicioDaSemana(data);
  const existente = await obterSemana(c, obraId, inicio);
  if (existente) return ok(existente);
  const { data: nova, error } = await c
    .from("semanas")
    .insert({ obra_id: obraId, inicio })
    .select(COLUNAS_SEMANA)
    .single();
  if (error) {
    if (error.code === UNICIDADE) {
      const corrida = await obterSemana(c, obraId, inicio);
      if (corrida) return ok(corrida);
    }
    console.error("criarRascunho:", error.message);
    return falha("Não foi possível criar a semana.");
  }
  return ok(nova as Semana);
}

type LinhaAtividade = Record<string, unknown> & { programacao_efetivo?: Record<string, unknown>[] | null };
type LinhaTurno = Record<string, unknown> & {
  efetivo?: Record<string, unknown>[] | null;
  atividades?: Record<string, unknown>[] | null;
};

const porCriacao = (a: Record<string, unknown>, b: Record<string, unknown>) =>
  String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) || String(a.id ?? "").localeCompare(String(b.id ?? ""));

const equipeDe = (linhas: Record<string, unknown>[] | null | undefined): EquipePrevista[] =>
  [...(linhas ?? [])].sort(porCriacao).map((e) => ({ funcao: e.funcao as string, quantidade: num(e.quantidade) }));

function atividadeDe(r: Record<string, unknown>, equipe: EquipePrevista[]): AtividadeProgramada {
  return {
    id: r.id as string,
    ordem: num(r.ordem),
    descricao: r.descricao as string,
    local: (r.local as string | null) ?? null,
    unidade: (r.unidade as string | null) ?? null,
    meta: num(r.meta),
    dias: ((r.dias as number[] | null) ?? []).map((d) => Number(d) as DiaSemana),
    periodo: r.periodo as Periodo,
    causa: (r.causa as Causa | null) ?? null,
    responsavel_id: (r.responsavel_id as string | null) ?? null,
    continua_de: (r.continua_de as string | null) ?? null,
    trazida_de: (r.trazida_de as string | null) ?? null,
    saldo_trazido: numOuNull(r.saldo_trazido),
    equipe,
  };
}

/** Dados ao vivo da semana (programação + turnos da obra com data na semana). */
export async function obterDadosSemana(c: SupabaseClient, semana: Semana): Promise<DadosSemana> {
  const fim = dataDoDia(semana.inicio, 6);
  const [pa, tu] = await Promise.all([
    c
      .from("programacao_atividades")
      .select("id, ordem, descricao, local, unidade, meta, dias, periodo, causa, responsavel_id, continua_de, trazida_de, saldo_trazido, created_at, programacao_efetivo(id, funcao, quantidade, created_at)")
      .eq("semana_id", semana.id),
    c
      .from("turnos")
      .select(
        "id, data, periodo, status, hora_inicio_prevista, hora_fim_prevista, hora_inicio_real, hora_fim_real, intervalo_inicio, intervalo_fim, efetivo(id, funcao, quantidade, responsavel_id, created_at), efetivo_ocorrencias(*), turno_equipes_iniciadas(responsavel_id, iniciou_em), turno_equipes_terminadas(responsavel_id, terminou_em), atividades(id, descricao, unidade, qtd_planejada, qtd_realizada, causa, ordem, created_at, programacao_atividade_id, tipo)",
      )
      .eq("obra_id", semana.obra_id)
      .gte("data", semana.inicio)
      .lte("data", fim),
  ]);
  const erro = pa.error ?? tu.error;
  if (erro) {
    console.error("obterDadosSemana:", erro.message);
    throw new Error(`obterDadosSemana: ${erro.message}`);
  }

  const atividades = ((pa.data ?? []) as LinhaAtividade[])
    .sort((a, b) => num(a.ordem) - num(b.ordem) || porCriacao(a, b))
    .map((r) => atividadeDe(r, equipeDe(r.programacao_efetivo)));
  const ids = new Set(atividades.map((a) => a.id));

  const execucoes: ExecucaoLigada[] = [];
  const turnos: TurnoDaSemana[] = ((tu.data ?? []) as LinhaTurno[]).map((t) => {
    const ats = [...(t.atividades ?? [])].sort((a, b) => num(a.ordem) - num(b.ordem) || porCriacao(a, b));
    for (const a of ats) {
      const prog = a.programacao_atividade_id as string | null;
      if (prog && ids.has(prog)) {
        execucoes.push({
          id: a.id as string,
          programacao_atividade_id: prog,
          turno_id: t.id as string,
          data: t.data as string,
          periodo: t.periodo as Periodo,
          status_turno: t.status as TurnoDaSemana["status"],
          qtd_planejada: num(a.qtd_planejada),
          qtd_realizada: numOuNull(a.qtd_realizada),
          causa: (a.causa as Causa | null) ?? null,
          tipo: (a.tipo as TipoAtividade | null) ?? null,
        });
      }
    }
    return {
      id: t.id as string,
      data: t.data as string,
      periodo: t.periodo as Periodo,
      status: t.status as TurnoDaSemana["status"],
      hora_inicio_prevista: (t.hora_inicio_prevista as string | null) ?? null,
      hora_fim_prevista: (t.hora_fim_prevista as string | null) ?? null,
      hora_inicio_real: (t.hora_inicio_real as string | null) ?? null,
      hora_fim_real: (t.hora_fim_real as string | null) ?? null,
      intervalo_inicio: (t.intervalo_inicio as string | null) ?? null,
      intervalo_fim: (t.intervalo_fim as string | null) ?? null,
      efetivo: [...((t.efetivo as Record<string, unknown>[] | null) ?? [])].sort(porCriacao).map((e) => ({
        funcao: e.funcao as string,
        quantidade: num(e.quantidade),
        responsavel_id: (e.responsavel_id as string | null) ?? null,
      })),
      ocorrencias: lerOcorrencias(t.efetivo_ocorrencias),
      iniciados: lerIniciados(t.turno_equipes_iniciadas),
      terminados: lerTerminados(t.turno_equipes_terminadas),
      extras: ats
        .filter((a) => !a.programacao_atividade_id)
        .map((a) => ({
          id: a.id as string,
          descricao: a.descricao as string,
          unidade: (a.unidade as string | null) ?? null,
          qtd_planejada: num(a.qtd_planejada),
          qtd_realizada: numOuNull(a.qtd_realizada),
        })),
    };
  });
  return { semana, atividades, execucoes, turnos };
}

/** Converte a foto (jsonb) para DadosSemana, normalizando números. */
function dadosDaFoto(f: DadosSemana): DadosSemana {
  return {
    semana: f.semana,
    atividades: f.atividades.map((a) => atividadeDe(a as unknown as Record<string, unknown>, a.equipe.map((e) => ({ funcao: e.funcao, quantidade: num(e.quantidade) })))),
    execucoes: f.execucoes.map((e) => ({ ...e, qtd_planejada: num(e.qtd_planejada), qtd_realizada: numOuNull(e.qtd_realizada) })),
    turnos: f.turnos.map((t) => ({
      ...t,
      efetivo: t.efetivo.map((e) => ({ funcao: e.funcao, quantidade: num(e.quantidade), responsavel_id: e.responsavel_id ?? null })),
      ocorrencias: lerOcorrencias(t.ocorrencias),
      iniciados: lerIniciados(t.iniciados),
      terminados: lerTerminados(t.terminados),
      extras: t.extras.map((x) => ({ ...x, qtd_planejada: num(x.qtd_planejada), qtd_realizada: numOuNull(x.qtd_realizada) })),
    })),
  };
}

/** Semana encerrada: última foto oficial; demais: ao vivo. */
export async function dadosOficiais(c: SupabaseClient, semana: Semana): Promise<DadosSemana> {
  if (semana.status !== "encerrada") return obterDadosSemana(c, semana);
  const { data, error } = await c
    .from("semana_versoes")
    .select("dados")
    .eq("semana_id", semana.id)
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("dadosOficiais:", error.message);
    throw new Error(`dadosOficiais: ${error.message}`);
  }
  if (!data) return obterDadosSemana(c, semana);
  return { ...dadosDaFoto(data.dados as DadosSemana), semana };
}

export async function listarSemanasComResumo(
  c: SupabaseClient,
  obraId: string,
): Promise<{ semana: Semana; ppc: PpcSemanal | null }[]> {
  const { data, error } = await c.from("semanas").select(COLUNAS_SEMANA).eq("obra_id", obraId).order("inicio", { ascending: false });
  if (error) {
    console.error("listarSemanasComResumo:", error.message);
    throw new Error(`listarSemanasComResumo: ${error.message}`);
  }
  return Promise.all(
    ((data ?? []) as Semana[]).map(async (semana) => ({
      semana,
      ppc: semana.status === "rascunho" ? null : resumirSemana(await dadosOficiais(c, semana)).ppc,
    })),
  );
}

function validarEntrada(d: EntradaAtividadeProgramada): Resultado<EntradaAtividadeProgramada> {
  const erros: Record<string, string> = {};
  const descricao = typeof d.descricao === "string" ? d.descricao.trim() : "";
  if (!descricao) erros.descricao = "Informe a descrição";
  Object.assign(
    erros,
    errosDeTamanho({
      descricao: { valor: descricao, max: LIMITES.descricao },
      local: { valor: d.local, max: LIMITES.local },
      unidade: { valor: d.unidade, max: LIMITES.unidade },
    }),
  );
  if (typeof d.meta !== "number" || !Number.isFinite(d.meta) || d.meta <= 0) erros.meta = "A meta deve ser maior que zero";
  else if (d.meta > QTD_PLANEJADA_MAX) erros.meta = "A meta deve ser no máximo 1.000.000.000";
  const dias = Array.isArray(d.dias) ? d.dias : [];
  if (dias.length === 0) erros.dias = "Marque ao menos um dia";
  else if (dias.some((x) => !Number.isInteger(x) || x < 0 || x > 6) || new Set(dias).size !== dias.length) erros.dias = "Dias inválidos";
  if (d.periodo !== "diurno" && d.periodo !== "noturno") erros.periodo = "Período inválido";
  if (d.saldo_trazido !== undefined && d.saldo_trazido !== null
      && (typeof d.saldo_trazido !== "number" || !Number.isFinite(d.saldo_trazido) || d.saldo_trazido < 0)) {
    erros.meta = "Saldo trazido inválido";
  }
  const { equipe, erro: erroEquipe } = validarEquipe(d.equipe);
  if (erroEquipe) erros.equipe = erroEquipe;
  const primeira = Object.values(erros)[0];
  if (primeira) return falha(primeira, erros);
  return ok({
    descricao,
    local: d.local?.trim() || null,
    unidade: d.unidade?.trim() || null,
    meta: d.meta,
    dias: [...dias].sort((a, b) => a - b),
    periodo: d.periodo,
    equipe,
    responsavel_id: typeof d.responsavel_id === "string" && d.responsavel_id ? d.responsavel_id : null,
    continua_de: typeof d.continua_de === "string" && d.continua_de ? d.continua_de : null,
    trazida_de: typeof d.trazida_de === "string" && d.trazida_de ? d.trazida_de : null,
    saldo_trazido: typeof d.trazida_de === "string" && d.trazida_de && typeof d.saldo_trazido === "number" ? d.saldo_trazido : null,
  });
}

export async function salvarAtividadeProgramada(
  c: SupabaseClient,
  semanaId: string,
  dados: EntradaAtividadeProgramada,
  id?: string,
): Promise<Resultado<{ id: string }>> {
  const v = validarEntrada(dados);
  if (!v.ok) return v;
  const { data, error } = await c.rpc("salvar_programacao_atividade", {
    p_semana_id: semanaId,
    p_id: id ?? null,
    p_dados: v.dados,
  });
  if (error) {
    if (erroBanco(error) === "programacao_incompativel") return falha(ERRO_DIAS_COM_EXECUCAO);
    if (error.code === UNICIDADE) return falha(ERRO_TRAZIDA_REPETIDA);
    console.error("salvarAtividadeProgramada:", error.message);
    return falha(mensagemProgramacao(error, "Não foi possível salvar a atividade."));
  }
  return ok({ id: data as string });
}

export async function removerAtividadeProgramada(c: SupabaseClient, id: string): Promise<Resultado> {
  const { error } = await c.from("programacao_atividades").delete().eq("id", id);
  if (error) {
    console.error("removerAtividadeProgramada:", error.message);
    return falha(mensagemProgramacao(error, "Não foi possível apagar a atividade."));
  }
  return ok(undefined);
}

async function mudarStatus(c: SupabaseClient, semanaId: string, campos: Record<string, unknown>, padrao: string): Promise<Resultado> {
  const { data, error } = await c.from("semanas").update(campos).eq("id", semanaId).select("id");
  if (error) {
    console.error("mudarStatus semana:", error.message);
    return falha(mensagemProgramacao(error, padrao));
  }
  if (!data || data.length === 0) return falha("Semana não encontrada");
  return ok(undefined);
}

export async function programarSemana(c: SupabaseClient, semanaId: string): Promise<Resultado> {
  return mudarStatus(c, semanaId, { status: "programada" }, "Não foi possível programar a semana.");
}

export async function encerrarSemana(c: SupabaseClient, semana: Semana, causas: Record<string, Causa>): Promise<Resultado> {
  const dados = await obterDadosSemana(c, semana);
  const abertos = rotuloTurnosAbertos(dados.turnos);
  if (abertos) return falha(`Feche os turnos da semana antes de encerrar: ${abertos}.`);
  const validas = Object.fromEntries(Object.entries(causas).filter(([, causa]) => causaValida(causa)));
  const { error } = await c.rpc("encerrar_semana", { p_semana_id: semana.id, p_causas: validas });
  if (error) {
    console.error("encerrarSemana:", error.message);
    return falha(mensagemProgramacao(error, "Não foi possível encerrar a semana."));
  }
  return ok(undefined);
}

const REABRIR_PARA: Partial<Record<StatusSemana, StatusSemana>> = { programada: "rascunho", encerrada: "programada" };

export async function reabrirSemana(c: SupabaseClient, semanaId: string, motivo: unknown): Promise<Resultado> {
  const m = validarMotivo(motivo);
  if (!m.ok) return m;
  const { data, error } = await c.from("semanas").select("status").eq("id", semanaId).maybeSingle();
  if (error || !data) return falha("Semana não encontrada");
  const destino = REABRIR_PARA[(data as { status: StatusSemana }).status];
  if (!destino) return falha(MENSAGENS_PROGRAMACAO.transicao_invalida!);
  return mudarStatus(c, semanaId, { status: destino, motivo_reabertura: m.dados }, "Não foi possível reabrir a semana.");
}

/** Item 1.6: resumo da semana anterior (segunda − 7) da mesma obra; null se não existe ou é rascunho. */
export async function resumoSemanaAnterior(c: SupabaseClient, semana: Pick<Semana, "obra_id" | "inicio">): Promise<ResumoSemana | null> {
  const anterior = await obterSemana(c, semana.obra_id, somarDias(semana.inicio, -7));
  if (!anterior || anterior.status === "rascunho") return null;
  return resumirSemana(await dadosOficiais(c, anterior));
}

/** "Atualizar meta" (item 1.6): meta da atividade trazida = saldo atual da origem na semana anterior. */
export async function atualizarMetaTrazida(c: SupabaseClient, atividadeId: string): Promise<Resultado<{ meta: number }>> {
  const { data: a, error } = await c
    .from("programacao_atividades")
    .select("id, trazida_de, semanas(obra_id, inicio)")
    .eq("id", atividadeId)
    .maybeSingle();
  if (error && error.code !== UUID_INVALIDO) {
    console.error("atualizarMetaTrazida:", error.message);
    return falha("Não foi possível atualizar a meta.");
  }
  const semana = (a?.semanas ?? null) as unknown as Pick<Semana, "obra_id" | "inicio"> | null;
  const naoVeio = falha("Esta atividade não veio da semana anterior.");
  if (!a || !a.trazida_de || !semana) return naoVeio;
  const resumo = await resumoSemanaAnterior(c, semana);
  const saldo = resumo ? saldoDaOrigem(resumo, a.trazida_de as string) : null;
  if (saldo === null) return naoVeio;
  if (saldo <= 0) return falha("A semana anterior já concluiu esta atividade.");
  const { data: feitas, error: eu } = await c
    .from("programacao_atividades")
    .update({ meta: saldo, saldo_trazido: saldo })
    .eq("id", atividadeId)
    .select("id");
  if (!eu && (!feitas || feitas.length === 0)) return naoVeio;
  if (eu) {
    console.error("atualizarMetaTrazida (update):", eu.message);
    return falha(mensagemProgramacao(eu, "Não foi possível atualizar a meta."));
  }
  return ok({ meta: saldo });
}

/** Semana da obra que contém `data` (null se ainda não foi criada). */
export async function semanaDoTurno(c: SupabaseClient, obraId: string, data: string): Promise<Semana | null> {
  return obterSemana(c, obraId, inicioDaSemana(data));
}

/**
 * Insere no turno as atividades programadas do dia/período ainda não trazidas, com a qtd sugerida
 * (meta ÷ dias, limitada ao saldo; último dia = saldo). Só para semana programada. Idempotente.
 */
export async function trazerDaProgramacao(c: SupabaseClient, turnoId: string): Promise<Resultado<{ adicionadas: number }>> {
  const t = await turnoEditavel(c, turnoId);
  if (!t.ok) return t;
  const turno = t.dados;
  const semana = await semanaDoTurno(c, turno.obra_id, turno.data);
  if (!semana || semana.status !== "programada") return ok({ adicionadas: 0 });
  const dia = diaDaSemana(semana.inicio, turno.data);
  if (dia === null) return ok({ adicionadas: 0 });

  const dados = await obterDadosSemana(c, semana);
  const jaNoTurno = new Set(dados.execucoes.filter((e) => e.turno_id === turnoId).map((e) => e.programacao_atividade_id));
  const { data: ordens, error: eo } = await c.from("atividades").select("ordem").eq("turno_id", turnoId);
  if (eo) {
    console.error("trazerDaProgramacao (ordem):", eo.message);
    return falha("Não foi possível trazer da programação.");
  }
  let ordem = (ordens ?? []).reduce((m, r) => Math.max(m, Number(r.ordem)), -1) + 1;
  const nomes = await nomesResponsaveis(c, turno.obra_id);

  const novas = dados.atividades
    .filter((a) => a.periodo === turno.periodo && !jaNoTurno.has(a.id))
    .map((a) => ({ a, m: metaNoTurno(dados, a.id, turno) }))
    .filter((x): x is { a: AtividadeProgramada; m: MetaNoTurno & { meta: number } } => x.m.meta !== null)
    .map(({ a, m }) => ({ a, qtd: m.meta, origem: textoOrigemMeta(m, a.unidade, nomes.get(m.anterior?.responsavel_id ?? "") ?? null) }))
    .map(({ a, qtd, origem }) => ({
      turno_id: turnoId,
      ordem: ordem++,
      descricao: a.descricao,
      local: a.local,
      unidade: a.unidade,
      qtd_planejada: qtd,
      programacao_atividade_id: a.id,
      responsavel_id: a.responsavel_id,
      meta_origem: origem,
    }));
  if (novas.length === 0) return ok({ adicionadas: 0 });

  const { error } = await c.from("atividades").insert(novas);
  if (!error) return ok({ adicionadas: novas.length });
  if (error.code !== UNICIDADE) {
    console.error("trazerDaProgramacao (insert):", error.message);
    return falha(mensagemProgramacao(error, "Não foi possível trazer da programação."));
  }
  // Corrida com outra chamada: insere uma a uma e pula as já presentes (índice turno_id+programacao_atividade_id).
  let adicionadas = 0;
  for (const nova of novas) {
    const { error: e1 } = await c.from("atividades").insert(nova);
    if (!e1) adicionadas++;
    else if (e1.code !== UNICIDADE) {
      console.error("trazerDaProgramacao (insert 1 a 1):", e1.message);
      return falha(mensagemProgramacao(e1, "Não foi possível trazer da programação."));
    }
  }
  return ok({ adicionadas });
}

/** Nomes dos responsáveis da obra (para a origem da meta herdada). Melhor esforço: vazio se falhar. */
export async function nomesResponsaveis(c: SupabaseClient, obraId: string): Promise<Map<string, string>> {
  const { data, error } = await c.from("responsaveis").select("id, nome").eq("obra_id", obraId);
  if (error) console.error("nomesResponsaveis:", error.message);
  return new Map(((data ?? []) as { id: string; nome: string }[]).map((r) => [r.id, r.nome]));
}

/** Semanas programadas/encerradas com início >= `desde`, resumidas para a análise de PPC. */
export async function listarProgramadasParaAnalise(
  c: SupabaseClient,
  obraId: string,
  desde: string,
): Promise<SemanaProgramadaAnalise[]> {
  const { data, error } = await c
    .from("semanas")
    .select(COLUNAS_SEMANA)
    .eq("obra_id", obraId)
    .in("status", ["programada", "encerrada"])
    .gte("inicio", desde)
    .order("inicio");
  if (error) {
    console.error("listarProgramadasParaAnalise:", error.message);
    throw new Error(`listarProgramadasParaAnalise: ${error.message}`);
  }
  return Promise.all(
    ((data ?? []) as Semana[]).map(async (semana) => {
      const r = resumirSemana(await dadosOficiais(c, semana));
      const encerrada = semana.status === "encerrada";
      return {
        inicio: semana.inicio,
        encerrada,
        cumpridas: r.ppc.cumpridas,
        total: r.ppc.total,
        naoCumpridas: r.atividades
          .filter((a) => a.situacao !== "cumprida")
          .map((a) => ({ descricao: a.descricao, causa: encerrada ? a.causa : (a.causa ?? a.causaSugerida) })),
      };
    }),
  );
}

/**
 * Opções de função para o efetivo do turno: as da equipe prevista na semana (as do dia/período do turno
 * primeiro). Sem programação com equipe, volta às funções sugeridas padrão.
 */
export async function opcoesFuncaoDoTurno(c: SupabaseClient, obraId: string, data: string, periodo: Periodo): Promise<string[]> {
  const semana = await semanaDoTurno(c, obraId, data);
  if (!semana) return [...FUNCOES_SUGERIDAS];
  const { data: linhas, error } = await c
    .from("programacao_atividades")
    .select("dias, periodo, programacao_efetivo(funcao)")
    .eq("semana_id", semana.id);
  if (error) {
    console.error("opcoesFuncaoDoTurno:", error.message);
    throw new Error(`opcoesFuncaoDoTurno: ${error.message}`);
  }
  const atividades = (linhas ?? []).map((r) => ({
    dias: ((r.dias as number[] | null) ?? []).map(Number) as DiaSemana[],
    periodo: r.periodo as Periodo,
    equipe: ((r.programacao_efetivo as { funcao: string }[] | null) ?? []).map((e) => ({ funcao: e.funcao, quantidade: 1 })),
  })) as AtividadeProgramada[];
  const funcoes = funcoesDaProgramacao(atividades, diaDaSemana(semana.inicio, data), periodo);
  return funcoes.length > 0 ? funcoes : [...FUNCOES_SUGERIDAS];
}

/** Sugestões de função na programação: as já usadas nas programações da obra, depois as padrão. */
export async function sugestoesFuncaoDaObra(c: SupabaseClient, obraId: string): Promise<string[]> {
  const { data, error } = await c
    .from("programacao_efetivo")
    .select("funcao, programacao_atividades!inner(semanas!inner(obra_id))")
    .eq("programacao_atividades.semanas.obra_id", obraId);
  if (error) {
    console.error("sugestoesFuncaoDaObra:", error.message);
    throw new Error(`sugestoesFuncaoDaObra: ${error.message}`);
  }
  const usadas = (data ?? []).map((r) => r.funcao as string).sort((a, b) => a.localeCompare(b, "pt-BR"));
  return unirFuncoes(usadas, [...FUNCOES_SUGERIDAS]);
}
