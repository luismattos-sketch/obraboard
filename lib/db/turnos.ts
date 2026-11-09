import type { SupabaseClient } from "@supabase/supabase-js";
import { compararTurnos, transicaoTurno, type AcaoTurno } from "@/lib/dominio/regras";
import { gerarToken, hashToken } from "@/lib/dominio/token";
import type { CondicaoClima, Periodo, PeriodoClima, StatusTurno } from "@/lib/dominio/tipos";
import { normalizarAtividade, type Atividade } from "./atividades";
import type { Obra } from "./obras";
import { falha, ok, type Resultado } from "./resultado";

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
};
export type Efetivo = { id: string; turno_id: string; funcao: string; quantidade: number };
export type Clima = { turno_id: string; periodo: PeriodoClima; condicao: CondicaoClima; impediu: boolean };
export type TurnoCompleto = Turno & { obra: Obra; atividades: Atividade[]; efetivo: Efetivo[]; clima: Clima[] };
export type TurnoComAtividades = Turno & {
  atividades: Pick<Atividade, "qtd_planejada" | "qtd_realizada">[];
};

export const COLUNAS_TURNO =
  "id, obra_id, data, periodo, hora_inicio_prevista, hora_fim_prevista, hora_inicio_real, hora_fim_real, status, token_hash, enviado_em, fechado_em";

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
    .select(`${COLUNAS_TURNO}, atividades(qtd_planejada, qtd_realizada)`)
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
      })),
    }),
  );
  return lista.sort((a, b) => compararTurnos(b, a));
}

export async function obterTurnoCompleto(c: SupabaseClient, turnoId: string): Promise<TurnoCompleto | null> {
  const { data, error } = await c
    .from("turnos")
    .select(
      `${COLUNAS_TURNO}, obra:obras(id, empresa_id, nome, cliente, endereco, created_at), atividades(*), efetivo(id, turno_id, funcao, quantidade), clima(turno_id, periodo, condicao, impediu)`,
    )
    .eq("id", turnoId)
    .maybeSingle();
  if (error) {
    if (error.code === UUID_INVALIDO) return null;
    console.error("obterTurnoCompleto:", error.message);
    throw new Error(`obterTurnoCompleto: ${error.message}`);
  }
  if (!data) return null;
  const t = data as unknown as Omit<TurnoCompleto, "atividades"> & { atividades: Record<string, unknown>[] | null };
  const atividades = (t.atividades ?? []).map(normalizarAtividade).sort((a, b) => a.ordem - b.ordem);
  return { ...t, atividades, efetivo: t.efetivo ?? [], clima: t.clima ?? [] };
}

export async function criarTurno(
  c: SupabaseClient,
  dados: {
    obra_id: string;
    data: string;
    periodo: Periodo;
    hora_inicio_prevista?: string | null;
    hora_fim_prevista?: string | null;
  },
): Promise<Resultado<Turno>> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.data)) return falha("Informe a data");
  if (dados.periodo !== "diurno" && dados.periodo !== "noturno") return falha("Período inválido");
  const { data, error } = await c
    .from("turnos")
    .insert({
      obra_id: dados.obra_id,
      data: dados.data,
      periodo: dados.periodo,
      hora_inicio_prevista: dados.hora_inicio_prevista || null,
      hora_fim_prevista: dados.hora_fim_prevista || null,
    })
    .select(COLUNAS_TURNO)
    .single();
  if (error) {
    if (error.code === "23505") return falha(`Já existe um turno ${dados.periodo} nesse dia`);
    console.error("criarTurno:", error.message);
    return falha("Não foi possível criar o turno.");
  }
  return ok(data as Turno);
}

const MSG_CONCORRENCIA = "O turno foi alterado por outra pessoa. Recarregue a página.";

/** Aplica uma transição de status lendo o estado atual do banco, com guarda otimista contra concorrência. */
export async function aplicarAcao(
  c: SupabaseClient,
  turnoId: string,
  acao: AcaoTurno,
): Promise<Resultado<{ status: StatusTurno; token?: string }>> {
  const turno = await obterTurnoCompleto(c, turnoId);
  if (!turno) return falha("Turno não encontrado");
  const t = transicaoTurno(turno.status, acao, { atividades: turno.atividades });
  if (!t.ok) return falha(t.erro);

  const mudancas: Record<string, unknown> = { status: t.novo };
  let token: string | undefined;
  if (acao === "liberar") {
    token = gerarToken();
    mudancas.token_hash = hashToken(token);
  }
  if (acao === "enviar") mudancas.enviado_em = new Date().toISOString();
  if (acao === "fechar") mudancas.fechado_em = new Date().toISOString();
  if (acao === "reabrir") mudancas.fechado_em = null;

  const { data, error } = await c.from("turnos").update(mudancas).eq("id", turnoId).eq("status", turno.status).select("id");
  if (error) {
    console.error("aplicarAcao:", error.message);
    return falha("Não foi possível atualizar o turno.");
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
    .update({ token_hash: hashToken(token) })
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
