import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { ERRO_FECHADO_CAMPO, ERRO_LIMITE_IA, ERRO_RELATO_TAMANHO, ERRO_RESPONSAVEL_INVALIDO, erroBanco } from "./mensagens";
import { falha, ok, type Resultado } from "./resultado";

/** Texto do "Conte como foi o dia", guardado antes de chamar a IA (spec 2026-11-22-ia-texto-livre). */
export type Relato = {
  id: string;
  responsavel_id: string;
  texto: string;
  tentativas: number;
  lancado: boolean;
  criado_em: string;
  atualizado_em: string;
};

export const LIMITE_TENTATIVAS = 20;
export const TEXTO_MAX = 1000;
const COLUNAS = "id, responsavel_id, texto, tentativas, lancado, criado_em, atualizado_em";
const ERRO_GENERICO = "Não foi possível guardar o texto. Tente novamente.";

const erroGravacao = (error: { code?: string; message?: string }, onde: string) => {
  if (erroBanco(error) === "turno_fechado") return falha(ERRO_FECHADO_CAMPO);
  if (erroBanco(error) === "responsavel_invalido") return falha(ERRO_RESPONSAVEL_INVALIDO);
  console.error(`${onde}:`, error.message);
  return falha(ERRO_GENERICO);
};

/**
 * Guarda o texto de uma rodada do "Organizar". `relatoId` de rodada ainda não lançada do mesmo
 * responsável = atualiza a mesma linha (tentativas + 1); senão cria outra. Conta para o limite.
 * Chamar só com `turnoId` e `responsavelId` já validados pelo token.
 */
export async function gravarTentativa(
  turnoId: string,
  responsavelId: string,
  texto: string,
  relatoId: string | null,
): Promise<Resultado<{ id: string; tentativas: number }>> {
  const t = typeof texto === "string" ? texto.trim() : "";
  if (t.length < 1 || t.length > TEXTO_MAX) return falha(ERRO_RELATO_TAMANHO);
  const admin = criarClienteAdmin();
  const { data: linhas, error: el } = await admin
    .from("relatos_campo")
    .select("id, tentativas, lancado")
    .eq("turno_id", turnoId)
    .eq("responsavel_id", responsavelId);
  if (el) return erroGravacao(el, "gravarTentativa (leitura)");
  const usadas = (linhas ?? []).reduce((s, r) => s + Number(r.tentativas), 0);
  if (usadas >= LIMITE_TENTATIVAS) return falha(ERRO_LIMITE_IA);

  const atual = relatoId ? (linhas ?? []).find((r) => r.id === relatoId && !r.lancado) : undefined;
  if (atual) {
    const tentativas = Number(atual.tentativas) + 1;
    const { error } = await admin
      .from("relatos_campo")
      .update({ texto: t, tentativas, atualizado_em: new Date().toISOString() })
      .eq("id", atual.id)
      .eq("turno_id", turnoId);
    if (error) return erroGravacao(error, "gravarTentativa (atualizar)");
    return ok({ id: atual.id as string, tentativas });
  }
  const { data, error } = await admin
    .from("relatos_campo")
    .insert({ turno_id: turnoId, responsavel_id: responsavelId, texto: t })
    .select("id")
    .single();
  if (error) return erroGravacao(error, "gravarTentativa (criar)");
  return ok({ id: data.id as string, tentativas: 1 });
}

export async function marcarLancado(turnoId: string, responsavelId: string, relatoId: string): Promise<Resultado> {
  const { error } = await criarClienteAdmin()
    .from("relatos_campo")
    .update({ lancado: true, atualizado_em: new Date().toISOString() })
    .eq("id", relatoId)
    .eq("turno_id", turnoId)
    .eq("responsavel_id", responsavelId);
  if (error && error.code !== "22P02") return erroGravacao(error, "marcarLancado");
  return ok(undefined);
}

/** Último relato não lançado do responsável no turno (a caixa volta preenchida). */
export async function relatoPendente(turnoId: string, responsavelId: string): Promise<Relato | null> {
  const { data, error } = await criarClienteAdmin()
    .from("relatos_campo")
    .select(COLUNAS)
    .eq("turno_id", turnoId)
    .eq("responsavel_id", responsavelId)
    .eq("lancado", false)
    .order("atualizado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("relatoPendente:", error.message);
    return null;
  }
  return (data as Relato | null) ?? null;
}

/** Planejador (sessão, RLS): relatos do turno, mais recente primeiro. */
export async function relatosDoTurno(c: SupabaseClient, turnoId: string): Promise<Relato[]> {
  const { data, error } = await c
    .from("relatos_campo")
    .select(COLUNAS)
    .eq("turno_id", turnoId)
    .order("atualizado_em", { ascending: false });
  if (error) {
    console.error("relatosDoTurno:", error.message);
    return [];
  }
  return (data ?? []) as Relato[];
}
