import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntradaQuadro, ResponsavelRef, TurnoRef } from "@/lib/dominio/quadro";
import { gerarToken, hashToken } from "@/lib/dominio/token";
import type { Causa, Periodo, StatusTurno } from "@/lib/dominio/tipos";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { falha, ok, type Resultado } from "./resultado";

/**
 * Leitura do quadro. Com o cliente da sessão (planejador, RLS) ou com o admin do link público —
 * nesse caso SEMPRE depois de resolver a obra pelo código (obraPorCodigo) e conferir que o turno é dela.
 */

export type FotoCheckin = { emitido_em: string; dados: EntradaQuadro };

const UUID_INVALIDO = "22P02";
const CODIGO_FORMATO = /^[A-Za-z0-9_-]{43}$/;
const numOuNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function entradaDoTurno(c: SupabaseClient, turnoId: string): Promise<EntradaQuadro | null> {
  const { data, error } = await c
    .from("turnos")
    .select(
      "id, obra_id, data, periodo, status, hora_inicio_prevista, hora_fim_prevista, hora_inicio_real, hora_fim_real, obra:obras(id, nome), atividades(id, ordem, descricao, local, unidade, qtd_planejada, qtd_realizada, causa, programacao_atividade_id, responsavel_id), efetivo(id, funcao, quantidade, responsavel_id, created_at)",
    )
    .eq("id", turnoId)
    .maybeSingle();
  if (error) {
    if (error.code === UUID_INVALIDO) return null;
    console.error("entradaDoTurno:", error.message);
    throw new Error(`entradaDoTurno: ${error.message}`);
  }
  if (!data) return null;
  const t = data as unknown as Record<string, unknown> & {
    obra: { id: string; nome: string };
    atividades: Record<string, unknown>[] | null;
    efetivo: Record<string, unknown>[] | null;
  };

  const atividades: EntradaQuadro["atividades"] = (t.atividades ?? []).map((a) => ({
    id: a.id as string,
    ordem: Number(a.ordem),
    descricao: a.descricao as string,
    local: (a.local as string | null) ?? null,
    unidade: (a.unidade as string | null) ?? null,
    qtd_planejada: Number(a.qtd_planejada),
    qtd_realizada: numOuNull(a.qtd_realizada),
    causa: (a.causa as Causa | null) ?? null,
    programada: a.programacao_atividade_id !== null && a.programacao_atividade_id !== undefined,
    responsavel_id: (a.responsavel_id as string | null) ?? null,
  }));
  const efetivo: EntradaQuadro["efetivo"] = [...(t.efetivo ?? [])]
    .sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)) || String(x.id).localeCompare(String(y.id)))
    .map((e) => ({ funcao: e.funcao as string, quantidade: Number(e.quantidade), responsavel_id: (e.responsavel_id as string | null) ?? null }));

  const ids = [...new Set([...atividades, ...efetivo].map((x) => x.responsavel_id))].filter((x): x is string => x !== null);
  let responsaveis: ResponsavelRef[] = [];
  if (ids.length > 0) {
    const r = await c.from("responsaveis").select("id, nome, ativo").eq("obra_id", t.obra_id as string).in("id", ids);
    if (r.error) {
      console.error("entradaDoTurno (responsaveis):", r.error.message);
      throw new Error(`entradaDoTurno: ${r.error.message}`);
    }
    responsaveis = ((r.data ?? []) as ResponsavelRef[]).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  return {
    obra: { id: t.obra.id, nome: t.obra.nome },
    turno: {
      id: t.id as string,
      data: t.data as string,
      periodo: t.periodo as Periodo,
      status: t.status as StatusTurno,
      hora_inicio_prevista: (t.hora_inicio_prevista as string | null) ?? null,
      hora_fim_prevista: (t.hora_fim_prevista as string | null) ?? null,
      hora_inicio_real: (t.hora_inicio_real as string | null) ?? null,
      hora_fim_real: (t.hora_fim_real as string | null) ?? null,
    },
    responsaveis,
    atividades,
    efetivo,
  };
}

export async function turnosDaObra(c: SupabaseClient, obraId: string): Promise<TurnoRef[]> {
  const { data, error } = await c.from("turnos").select("id, data, periodo, status").eq("obra_id", obraId);
  if (error) {
    if (error.code === UUID_INVALIDO) return [];
    console.error("turnosDaObra:", error.message);
    throw new Error(`turnosDaObra: ${error.message}`);
  }
  return (data ?? []) as TurnoRef[];
}

export async function fotoCheckin(c: SupabaseClient, turnoId: string): Promise<FotoCheckin | null> {
  const { data, error } = await c.from("checkin_fotos").select("emitido_em, dados").eq("turno_id", turnoId).maybeSingle();
  if (error) {
    if (error.code === UUID_INVALIDO) return null;
    console.error("fotoCheckin:", error.message);
    throw new Error(`fotoCheckin: ${error.message}`);
  }
  if (!data) return null;
  const d = data as { emitido_em: string; dados: EntradaQuadro };
  // Números do jsonb podem vir como string em versões futuras do formato: normaliza.
  const dados: EntradaQuadro = {
    ...d.dados,
    atividades: d.dados.atividades.map((a) => ({ ...a, qtd_planejada: Number(a.qtd_planejada), qtd_realizada: numOuNull(a.qtd_realizada) })),
  };
  return { emitido_em: d.emitido_em, dados };
}

/** Gera (ou troca) o código do link do quadro; o código só existe aqui, o banco guarda o hash. */
export async function gerarLinkQuadro(c: SupabaseClient, obraId: string): Promise<Resultado<{ codigo: string }>> {
  const codigo = gerarToken();
  const { data, error } = await c.from("obras").update({ quadro_token_hash: hashToken(codigo) }).eq("id", obraId).select("id");
  if (error && error.code !== UUID_INVALIDO) {
    console.error("gerarLinkQuadro:", error.message);
    return falha("Não foi possível gerar o link do quadro.");
  }
  if (!data || data.length === 0) return falha("Obra não encontrada");
  return ok({ codigo });
}

export async function temLinkQuadro(c: SupabaseClient, obraId: string): Promise<boolean> {
  const { data, error } = await c.from("obras").select("quadro_token_hash").eq("id", obraId).maybeSingle();
  if (error) {
    if (error.code === UUID_INVALIDO) return false;
    console.error("temLinkQuadro:", error.message);
    throw new Error(`temLinkQuadro: ${error.message}`);
  }
  return !!(data as { quadro_token_hash: string | null } | null)?.quadro_token_hash;
}

export async function obraPorCodigo(codigo: string): Promise<{ id: string } | null> {
  if (typeof codigo !== "string" || !CODIGO_FORMATO.test(codigo)) return null;
  const { data, error } = await criarClienteAdmin()
    .from("obras")
    .select("id")
    .eq("quadro_token_hash", hashToken(codigo))
    .maybeSingle();
  if (error) {
    console.error("obraPorCodigo:", error.message);
    throw new Error("obraPorCodigo");
  }
  return (data as { id: string } | null) ?? null;
}

/** Cliente para o quadro público: usar SÓ com a obra já resolvida por obraPorCodigo. */
export function clienteDoQuadroPublico(): SupabaseClient {
  return criarClienteAdmin();
}
