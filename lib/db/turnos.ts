import type { SupabaseClient } from "@supabase/supabase-js";
import type { TurnoAnalise } from "@/lib/dominio/analise";
import type { TurnoHH } from "@/lib/dominio/hhPerdido";
import { ERRO_MOTIVO, ERRO_MOTIVO_REPETIDO, validarMotivo } from "@/lib/dominio/eventos";
import { aderencia } from "@/lib/dominio/ritmo";
import { hojeSaoPaulo } from "@/lib/dominio/entrada";
import { compararTurnos, transicaoTurno, type AcaoTurno } from "@/lib/dominio/regras";
import { gerarToken, hashToken } from "@/lib/dominio/token";
import type { Periodo, StatusTurno, TipoAtividade } from "@/lib/dominio/tipos";
import { lerIniciados, lerOcorrencias, lerTerminados, type Iniciado, type Ocorrencia, type Terminado } from "@/lib/dominio/efetivoHH";
import { normalizarAtividade, type Atividade } from "./atividades";
import type { Obra } from "./obras";
import type { ClimaTurno } from "@/lib/clima/tipos";
import { gravarClimaTurno, lerClimaTurno } from "./clima";
import { ERRO_CAUSA_PENDENTE, ERRO_FECHADO_PLANEJADOR, ERRO_SO_PLANEJADO, erroBanco } from "./mensagens";
import { trazerDaProgramacao } from "./programacao";
import { falha, ok, type Resultado } from "./resultado";
import { validarHorariosPrevistos } from "./validacao";

export type Turno = {
  id: string;
  obra_id: string;
  data: string;
  periodo: Periodo;
  hora_inicio_prevista: string | null;
  hora_fim_prevista: string | null;
  hora_inicio_real: string | null;
  hora_fim_real: string | null;
  status: StatusTurno;
  token_hash: string | null;
  enviado_em: string | null;
  fechado_em: string | null;
  /** Intervalo de refeição gravado no turno (nulo = sem intervalo). */
  intervalo_inicio: string | null;
  intervalo_fim: string | null;
};
export type Efetivo = {
  id: string;
  turno_id: string;
  funcao: string;
  quantidade: number;
  responsavel_id: string | null;
  /** Hora do último salvamento da equipe (linhas recriadas a cada vez). Ausente em fotos antigas. */
  created_at?: string;
  lancado_pelo_planejador?: boolean;
};
export type TurnoCompleto = Turno & {
  obra: Obra;
  atividades: Atividade[];
  efetivo: Efetivo[];
  /** Clima automático gravado no enviar/fechar (null = ainda não ou indisponível). */
  clima_turno: ClimaTurno | null;
  ocorrencias: Ocorrencia[];
  /** Equipes que tocaram "Terminei minha parte" (ausente nas fotos antigas = nenhuma). */
  terminados?: Terminado[];
  /** Equipes que tocaram "Iniciar turno" (ausente = nenhuma). */
  iniciados?: Iniciado[];
  /** Nomes dos responsáveis da obra (para descrever empréstimos). */
  responsaveis: { id: string; nome: string }[];
};
export type TurnoComAtividades = Turno & {
  atividades: Pick<Atividade, "qtd_planejada" | "qtd_realizada" | "tipo">[];
};

export const COLUNAS_TURNO =
  "id, obra_id, data, periodo, hora_inicio_prevista, hora_fim_prevista, hora_inicio_real, hora_fim_real, status, token_hash, enviado_em, fechado_em, intervalo_inicio, intervalo_fim";

const UUID_INVALIDO = "22P02";

export async function listarTurnos(c: SupabaseClient, obraId: string): Promise<Turno[]> {
  const { data, error } = await c.from("turnos").select(COLUNAS_TURNO).eq("obra_id", obraId);
  if (error) {
    console.error("listarTurnos:", error.message);
    throw new Error(`listarTurnos: ${error.message}`);
  }
  return ((data ?? []) as Turno[]).sort((a, b) => compararTurnos(b, a));
}

/** Turnos da obra com quantidades das atividades (para o % de cumprimento), mais recentes primeiro. */
export async function listarTurnosComAtividades(
  c: SupabaseClient,
  obraId: string,
): Promise<TurnoComAtividades[]> {
  const { data, error } = await c
    .from("turnos")
    .select(`${COLUNAS_TURNO}, atividades(qtd_planejada, qtd_realizada, tipo)`)
    .eq("obra_id", obraId);
  if (error) {
    console.error("listarTurnosComAtividades:", error.message);
    throw new Error(`listarTurnosComAtividades: ${error.message}`);
  }
  const lista = ((data ?? []) as unknown as Array<Turno & { atividades: Record<string, unknown>[] | null }>).map(
    (t) => ({
      ...t,
      atividades: (t.atividades ?? []).map((a) => ({
        qtd_planejada: Number(a.qtd_planejada),
        qtd_realizada: a.qtd_realizada === null || a.qtd_realizada === undefined ? null : Number(a.qtd_realizada),
        tipo: (a.tipo as TipoAtividade | null) ?? null,
      })),
    }),
  );
  return lista.sort((a, b) => compararTurnos(b, a));
}

/** Data (YYYY-MM-DD) em que a obra começou: a mais antiga entre o cadastro, o 1º turno e a 1ª semana programada. */
export async function inicioDaObra(c: SupabaseClient, obraId: string, criadaEm: string): Promise<string> {
  const [t, s] = await Promise.all([
    c.from("turnos").select("data").eq("obra_id", obraId).order("data").limit(1).maybeSingle(),
    c.from("semanas").select("inicio").eq("obra_id", obraId).order("inicio").limit(1).maybeSingle(),
  ]);
  if (t.error) throw t.error;
  if (s.error) throw s.error;
  return [hojeSaoPaulo(new Date(criadaEm)), t.data?.data as string | undefined, s.data?.inicio as string | undefined]
    .filter((d): d is string => !!d)
    .sort()[0];
}

/** Turnos fechados da obra com data >= `desde` (YYYY-MM-DD), com atividades em ordem, para a análise de PPC. */
export async function listarTurnosFechadosParaAnalise(
  c: SupabaseClient,
  obraId: string,
  desde: string,
): Promise<TurnoAnalise[]> {
  const { data, error } = await c
    .from("turnos")
    .select("id, data, periodo, status, atividades(descricao, qtd_planejada, qtd_realizada, causa, observacao, ordem, tipo)")
    .eq("obra_id", obraId)
    .eq("status", "fechado")
    .gte("data", desde);
  if (error) {
    console.error("listarTurnosFechadosParaAnalise:", error.message);
    throw new Error(`listarTurnosFechadosParaAnalise: ${error.message}`);
  }
  type Linha = Omit<TurnoAnalise, "atividades"> & { atividades: Record<string, unknown>[] | null };
  return ((data ?? []) as unknown as Linha[]).map((t) => ({
    id: t.id,
    data: t.data,
    periodo: t.periodo,
    status: t.status,
    // Extra e adiantada não entram no PPC do turno (nem nas causas).
    atividades: [...(t.atividades ?? [])]
      .filter((a) => !a.tipo)
      .sort((x, y) => Number(x.ordem) - Number(y.ordem))
      .map((a) => ({
        descricao: a.descricao as string,
        qtd_planejada: Number(a.qtd_planejada),
        qtd_realizada: a.qtd_realizada === null || a.qtd_realizada === undefined ? null : Number(a.qtd_realizada),
        causa: (a.causa as TurnoAnalise["atividades"][number]["causa"]) ?? null,
        observacao: (a.observacao as string | null) ?? null,
      })),
  }));
}

/** Item 3.5: turnos fechados com data >= `desde`, com efetivo, paradas e Iniciar/Terminei, para o HH perdido. */
export async function listarTurnosParaHHPerdido(c: SupabaseClient, obraId: string, desde: string): Promise<TurnoHH[]> {
  const { data, error } = await c
    .from("turnos")
    .select(
      "id, data, periodo, hora_inicio_prevista, hora_fim_prevista, hora_inicio_real, hora_fim_real, intervalo_inicio, intervalo_fim, efetivo(funcao, quantidade, responsavel_id), efetivo_ocorrencias(*), turno_equipes_terminadas(responsavel_id, terminou_em), turno_equipes_iniciadas(responsavel_id, iniciou_em)",
    )
    .eq("obra_id", obraId)
    .eq("status", "fechado")
    .gte("data", desde);
  if (error) {
    console.error("listarTurnosParaHHPerdido:", error.message);
    throw new Error(`listarTurnosParaHHPerdido: ${error.message}`);
  }
  type Linha = Omit<TurnoHH, "efetivo" | "ocorrencias" | "iniciados" | "terminados"> & {
    efetivo: { funcao: string; quantidade: number; responsavel_id: string | null }[] | null;
    efetivo_ocorrencias: unknown;
    turno_equipes_terminadas: unknown;
    turno_equipes_iniciadas: unknown;
  };
  return ((data ?? []) as unknown as Linha[]).map(({ efetivo, efetivo_ocorrencias, turno_equipes_terminadas, turno_equipes_iniciadas, ...t }) => ({
    ...t,
    efetivo: (efetivo ?? []).map((e) => ({ funcao: e.funcao, quantidade: Number(e.quantidade), responsavel_id: e.responsavel_id ?? null })),
    ocorrencias: lerOcorrencias(efetivo_ocorrencias),
    terminados: lerTerminados(turno_equipes_terminadas),
    iniciados: lerIniciados(turno_equipes_iniciadas),
  }));
}

export async function obterTurnoCompleto(c: SupabaseClient, turnoId: string): Promise<TurnoCompleto | null> {
  const { data, error } = await c
    .from("turnos")
    .select(
      `${COLUNAS_TURNO}, obra:obras(id, empresa_id, nome, cliente, endereco, created_at, whatsapp_planejador, local_nome, latitude, longitude), atividades(*, programacao_atividades(programacao_efetivo(funcao, quantidade, created_at))), efetivo(id, turno_id, funcao, quantidade, responsavel_id, created_at, lancado_pelo_planejador), clima_turno(temp_media, temp_max, temp_min, chuva_mm, choveu, leituras), efetivo_ocorrencias(*), turno_equipes_terminadas(responsavel_id, terminou_em), turno_equipes_iniciadas(responsavel_id, iniciou_em)`,
    )
    .eq("id", turnoId)
    .maybeSingle();
  if (error) {
    if (error.code === UUID_INVALIDO) return null;
    console.error("obterTurnoCompleto:", error.message);
    throw new Error(`obterTurnoCompleto: ${error.message}`);
  }
  if (!data) return null;
  const { efetivo_ocorrencias, turno_equipes_terminadas, turno_equipes_iniciadas, clima_turno, ...t } = data as unknown as Omit<TurnoCompleto, "atividades" | "ocorrencias" | "responsaveis" | "terminados" | "iniciados" | "clima_turno"> & {
    clima_turno: unknown;
    atividades: Record<string, unknown>[] | null;
    efetivo_ocorrencias: unknown;
    turno_equipes_terminadas: Terminado[] | null;
    turno_equipes_iniciadas: Iniciado[] | null;
  };
  const atividades = (t.atividades ?? []).map(normalizarAtividade).sort((a, b) => a.ordem - b.ordem);
  const { data: resp, error: er } = await c.from("responsaveis").select("id, nome").eq("obra_id", t.obra_id);
  if (er) {
    console.error("obterTurnoCompleto (responsáveis):", er.message);
    throw new Error(`obterTurnoCompleto: ${er.message}`);
  }
  return {
    ...t,
    atividades,
    efetivo: t.efetivo ?? [],
    clima_turno: lerClimaTurno(clima_turno),
    ocorrencias: lerOcorrencias(efetivo_ocorrencias),
    terminados: lerTerminados(turno_equipes_terminadas),
    iniciados: lerIniciados(turno_equipes_iniciadas),
    responsaveis: (resp ?? []) as { id: string; nome: string }[],
  };
}

export type DadosTurno = {
  data: string;
  periodo: Periodo;
  hora_inicio_prevista?: string | null;
  hora_fim_prevista?: string | null;
};

/** Valida e normaliza data/período/horários previstos (criação e edição). */
function lerDadosTurno(dados: DadosTurno): Resultado<Required<DadosTurno>> {
  if (typeof dados.data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dados.data)) return falha("Informe a data");
  if (dados.periodo !== "diurno" && dados.periodo !== "noturno") return falha("Período inválido");
  const h = validarHorariosPrevistos(dados);
  if (!h.ok) return h;
  return ok({
    data: dados.data,
    periodo: dados.periodo,
    hora_inicio_prevista: dados.hora_inicio_prevista || null,
    hora_fim_prevista: dados.hora_fim_prevista || null,
  });
}

export const ERRO_TURNO_COM_PROGRAMACAO =
  "Este turno tem atividades da programação. Remova-as antes de mudar a data ou o período.";

const duplicado = (periodo: Periodo) => falha(`Já existe um turno ${periodo} nesse dia`);

export async function criarTurno(c: SupabaseClient, dados: DadosTurno & { obra_id: string }): Promise<Resultado<Turno>> {
  const d = lerDadosTurno(dados);
  if (!d.ok) return d;
  const { data, error } = await c
    .from("turnos")
    .insert({ obra_id: dados.obra_id, ...d.dados })
    .select(COLUNAS_TURNO)
    .single();
  if (error) {
    if (error.code === "23505") return duplicado(d.dados.periodo);
    console.error("criarTurno:", error.message);
    return falha("Não foi possível criar o turno.");
  }
  // Semana programada: o turno já nasce com as atividades do dia. Falha aqui não desfaz o turno
  // (o botão "Trazer da programação" resolve depois).
  const trazidas = await trazerDaProgramacao(c, (data as Turno).id).catch((e: unknown) => falha(String(e)));
  if (!trazidas.ok) console.error("criarTurno (trazer da programação):", trazidas.erro);
  return ok(data as Turno);
}

/** Status atual do turno (via RLS); null se não existe ou não é visível. */
async function lerStatus(c: SupabaseClient, turnoId: string, contexto: string): Promise<Resultado<StatusTurno | null>> {
  const { data, error } = await c.from("turnos").select("status").eq("id", turnoId).maybeSingle();
  if (error && error.code !== UUID_INVALIDO) {
    console.error(`${contexto}:`, error.message);
    return falha("Não foi possível atualizar o turno.");
  }
  return ok(data ? (data as { status: StatusTurno }).status : null);
}

/** Altera data, período e horários previstos. Só enquanto planejado. */
export async function editarTurno(c: SupabaseClient, turnoId: string, dados: DadosTurno): Promise<Resultado<Turno>> {
  const d = lerDadosTurno(dados);
  if (!d.ok) return d;
  const s = await lerStatus(c, turnoId, "editarTurno");
  if (!s.ok) return s;
  if (s.dados === null) return falha("Turno não encontrado");
  if (s.dados !== "planejado") return falha(ERRO_SO_PLANEJADO);

  const { data, error } = await c
    .from("turnos")
    .update(d.dados)
    .eq("id", turnoId)
    .eq("status", "planejado")
    .select(COLUNAS_TURNO);
  if (error) {
    if (error.code === "23505") return duplicado(d.dados.periodo);
    if (erroBanco(error) === "programacao_incompativel") return falha(ERRO_TURNO_COM_PROGRAMACAO);
    console.error("editarTurno:", error.message);
    return falha("Não foi possível alterar o turno.");
  }
  if (!data || data.length === 0) return falha(ERRO_SO_PLANEJADO); // mudou de status no meio
  return ok(data[0] as Turno);
}

/** Exclui o turno e suas atividades (cascata). Só enquanto planejado. */
export async function removerTurno(c: SupabaseClient, turnoId: string): Promise<Resultado> {
  const s = await lerStatus(c, turnoId, "removerTurno");
  if (!s.ok) return s;
  if (s.dados === null) return falha("Turno não encontrado");
  if (s.dados !== "planejado") return falha(ERRO_SO_PLANEJADO);

  const { data, error } = await c.from("turnos").delete().eq("id", turnoId).eq("status", "planejado").select("id");
  if (error) {
    console.error("removerTurno:", error.message);
    return falha("Não foi possível excluir o turno.");
  }
  if (!data || data.length === 0) return falha(ERRO_SO_PLANEJADO);
  return ok(undefined);
}

const MSG_CONCORRENCIA = "O turno foi alterado por outra pessoa. Recarregue a página.";

/** Aplica uma transição de status lendo o estado atual do banco, com guarda otimista contra concorrência. */
export async function aplicarAcao(
  c: SupabaseClient,
  turnoId: string,
  acao: AcaoTurno,
  opcoes: { motivo?: string } = {},
): Promise<Resultado<{ status: StatusTurno; token?: string }>> {
  let motivo: string | undefined;
  if (acao === "reabrir") {
    const m = validarMotivo(opcoes.motivo);
    if (!m.ok) return m;
    motivo = m.dados;
  }
  const turno = await obterTurnoCompleto(c, turnoId);
  if (!turno) return falha("Turno não encontrado");
  const t = transicaoTurno(turno.status, acao, { atividades: turno.atividades, horario: turno });
  if (!t.ok) return falha(t.erro);
  if (acao === "enviar" || acao === "fechar") await gravarClimaTurno(c, turno);

  const mudancas: Record<string, unknown> = { status: t.novo };
  let token: string | undefined;
  if (acao === "liberar") {
    token = gerarToken();
    mudancas.token_hash = hashToken(token);
    mudancas.token_campo = token;
  }
  if (acao === "enviar") mudancas.enviado_em = new Date().toISOString();
  if (acao === "fechar") mudancas.fechado_em = new Date().toISOString();
  if (acao === "reabrir") {
    mudancas.fechado_em = null;
    mudancas.motivo_reabertura = motivo;
  }

  const { data, error } = await c.from("turnos").update(mudancas).eq("id", turnoId).eq("status", turno.status).select("id");
  if (error) {
    // Triggers do banco (corrida entre a leitura acima e a gravação).
    const b = erroBanco(error);
    if (b === "causa_pendente") return falha(ERRO_CAUSA_PENDENTE);
    if (b === "turno_fechado") return falha(ERRO_FECHADO_PLANEJADOR);
    if (b === "motivo_obrigatorio") return falha(ERRO_MOTIVO);
    if (b === "motivo_repetido") return falha(ERRO_MOTIVO_REPETIDO);
    console.error("aplicarAcao:", error.message);
    return falha(acao === "liberar" ? "Não foi possível liberar o turno. Tente de novo." : "Não foi possível atualizar o turno.");
  }
  if (!data || data.length === 0) return falha(MSG_CONCORRENCIA);
  return ok(token ? { status: t.novo, token } : { status: t.novo });
}

/** Gera um novo link secreto (o anterior deixa de funcionar). Só em campo ou enviado. */
export async function gerarNovoLink(c: SupabaseClient, turnoId: string): Promise<Resultado<{ token: string }>> {
  const { data: atual, error: e1 } = await c.from("turnos").select("status").eq("id", turnoId).maybeSingle();
  if (e1 && e1.code !== UUID_INVALIDO) {
    console.error("gerarNovoLink:", e1.message);
    return falha("Não foi possível gerar o link.");
  }
  if (!atual) return falha("Turno não encontrado");
  const status = (atual as { status: StatusTurno }).status;
  if (status !== "em_campo" && status !== "enviado") return falha("Só é possível gerar link para turno em campo ou enviado.");

  const token = gerarToken();
  const { data, error } = await c
    .from("turnos")
    .update({ token_hash: hashToken(token), token_campo: token })
    .eq("id", turnoId)
    .eq("status", status)
    .select("id");
  if (error) {
    console.error("gerarNovoLink:", error.message);
    return falha("Não foi possível gerar o link.");
  }
  if (!data || data.length === 0) return falha(MSG_CONCORRENCIA);
  return ok({ token });
}

/** Link de campo atual para o planejador (RLS de membro). token nulo com existe = link criado antes de guardarmos o token. */
export async function linkCampo(c: SupabaseClient, turnoId: string): Promise<{ existe: boolean; token: string | null }> {
  const { data, error } = await c.from("turnos").select("token_hash, token_campo").eq("id", turnoId).maybeSingle();
  if (error) {
    if (error.code === UUID_INVALIDO) return { existe: false, token: null };
    console.error("linkCampo:", error.message);
    throw new Error(`linkCampo: ${error.message}`);
  }
  const d = data as { token_hash: string | null; token_campo: string | null } | null;
  return { existe: !!d?.token_hash, token: d?.token_hash ? (d.token_campo ?? null) : null };
}


const PAGINA_ADERENCIA = 500;

/**
 * Aderência da obra (turnos fechados desde o início, sem extra/adiantada) para o quadro.
 * Leitura enxuta (só quantidades) e paginada: o PostgREST corta em 1000 linhas sem avisar.
 */
export async function aderenciaDaObra(c: SupabaseClient, obraId: string): Promise<{ concluidas: number; total: number; ppc: number | null }> {
  type Linha = { atividades: { qtd_planejada: unknown; qtd_realizada: unknown; tipo: unknown }[] | null };
  const turnos: { atividades: { qtd_planejada: number; qtd_realizada: number | null }[] }[] = [];
  for (let de = 0; ; de += PAGINA_ADERENCIA) {
    const { data, error } = await c
      .from("turnos")
      .select("atividades(qtd_planejada, qtd_realizada, tipo)")
      .eq("obra_id", obraId)
      .eq("status", "fechado")
      .order("id")
      .range(de, de + PAGINA_ADERENCIA - 1);
    if (error) {
      console.error("aderenciaDaObra:", error.message);
      throw new Error(`aderenciaDaObra: ${error.message}`);
    }
    const linhas = (data ?? []) as unknown as Linha[];
    for (const t of linhas) {
      turnos.push({
        atividades: (t.atividades ?? [])
          .filter((a) => !a.tipo)
          .map((a) => ({ qtd_planejada: Number(a.qtd_planejada), qtd_realizada: a.qtd_realizada === null ? null : Number(a.qtd_realizada) })),
      });
    }
    if (linhas.length < PAGINA_ADERENCIA) break;
  }
  return aderencia(turnos);
}
