import type { SupabaseClient } from "@supabase/supabase-js";
import { inicioDaSemana } from "@/lib/dominio/analise";
import { validarMotivo } from "@/lib/dominio/eventos";
import {
  dataDoDia,
  diaDaSemana,
  realizadoAte,
  resumirSemana,
  rotuloTurnosAbertos,
  type AtividadeProgramada,
  type DadosSemana,
  type DiaSemana,
  type EquipePrevista,
  type ExecucaoLigada,
  type PpcSemanal,
  type Semana,
  type StatusSemana,
  type TurnoDaSemana,
  sugestaoDoDia,
} from "@/lib/dominio/programacao";
import type { Causa, Periodo } from "@/lib/dominio/tipos";
import { turnoEditavel } from "./atividades";
import { MENSAGENS_PROGRAMACAO, mensagemProgramacao } from "./mensagens";
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
};

const COLUNAS_SEMANA = "id, obra_id, inicio, status, programada_em, encerrada_em, motivo_reabertura";
const UNICIDADE = "23505";
const UUID_INVALIDO = "22P02";
const QTD_PESSOAS_MAX = 10_000;
const FUNCAO_MAX = 60;
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
    equipe,
  };
}

/** Dados ao vivo da semana (programação + turnos da obra com data na semana). */
export async function obterDadosSemana(c: SupabaseClient, semana: Semana): Promise<DadosSemana> {
  const fim = dataDoDia(semana.inicio, 6);
  const [pa, tu] = await Promise.all([
    c
      .from("programacao_atividades")
      .select("id, ordem, descricao, local, unidade, meta, dias, periodo, causa, created_at, programacao_efetivo(id, funcao, quantidade, created_at)")
      .eq("semana_id", semana.id),
    c
      .from("turnos")
      .select(
        "id, data, periodo, status, hora_inicio_prevista, hora_fim_prevista, hora_inicio_real, hora_fim_real, efetivo(id, funcao, quantidade, created_at), atividades(id, descricao, unidade, qtd_planejada, qtd_realizada, causa, ordem, created_at, programacao_atividade_id)",
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
      efetivo: equipeDe(t.efetivo),
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
      efetivo: t.efetivo.map((e) => ({ funcao: e.funcao, quantidade: num(e.quantidade) })),
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
  const equipe = (Array.isArray(d.equipe) ? d.equipe : []).map((e) => ({ funcao: String(e.funcao ?? "").trim(), quantidade: e.quantidade }));
  if (equipe.some((e) => !e.funcao)) erros.equipe = "Informe a função de cada linha da equipe";
  else if (equipe.some((e) => e.funcao.length > FUNCAO_MAX)) erros.equipe = `Função com no máximo ${FUNCAO_MAX} caracteres`;
  else if (equipe.some((e) => !Number.isInteger(e.quantidade) || e.quantidade <= 0 || e.quantidade > QTD_PESSOAS_MAX)) {
    erros.equipe = "Quantidade de pessoas inválida";
  }
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
  const outras = dados.execucoes.filter((e) => e.turno_id !== turnoId);
  const { data: ordens, error: eo } = await c.from("atividades").select("ordem").eq("turno_id", turnoId);
  if (eo) {
    console.error("trazerDaProgramacao (ordem):", eo.message);
    return falha("Não foi possível trazer da programação.");
  }
  let ordem = (ordens ?? []).reduce((m, r) => Math.max(m, Number(r.ordem)), -1) + 1;

  const novas = dados.atividades
    .filter((a) => a.periodo === turno.periodo && !jaNoTurno.has(a.id))
    .map((a) => ({ a, qtd: sugestaoDoDia(a, dia, realizadoAte(outras, a.id)) }))
    .filter((x): x is { a: AtividadeProgramada; qtd: number } => x.qtd !== null)
    .map(({ a, qtd }) => ({
      turno_id: turnoId,
      ordem: ordem++,
      descricao: a.descricao,
      local: a.local,
      unidade: a.unidade,
      qtd_planejada: qtd,
      programacao_atividade_id: a.id,
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
