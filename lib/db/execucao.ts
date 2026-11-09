import type { SupabaseClient } from "@supabase/supabase-js";
import { statusAtividade } from "@/lib/dominio/calculos";
import type { PeriodoClima, StatusTurno } from "@/lib/dominio/tipos";
import { falha, ok, type Resultado } from "./resultado";
import {
  camposExecucao,
  validarClima,
  validarEfetivo,
  validarExecucao,
  validarHorario,
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

const ERRO_FECHADO = "Turno fechado: reabra para editar";
const ERRO_GENERICO = "Não foi possível salvar. Tente novamente.";

async function turnoAbertoParaCorrecao(c: SupabaseClient, turnoId: string): Promise<Resultado> {
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

export async function salvarExecucaoPlanejador(
  c: SupabaseClient,
  turnoId: string,
  atividadeId: string,
  dados: DadosExecucao,
): Promise<Resultado> {
  const v = validarExecucao(dados);
  if (!v.ok) return v;
  const t = await turnoAbertoParaCorrecao(c, turnoId);
  if (!t.ok) return t;

  const { data: at, error: ea } = await c
    .from("atividades")
    .select("id, qtd_planejada")
    .eq("id", atividadeId)
    .eq("turno_id", turnoId)
    .maybeSingle();
  if (ea && ea.code !== "22P02") {
    console.error("salvarExecucaoPlanejador (leitura):", ea.message);
    return falha(ERRO_GENERICO);
  }
  if (!at) return falha("Atividade não encontrada");

  const concluida = statusAtividade(Number(at.qtd_planejada), dados.qtd_realizada) === "concluida";
  const { data, error } = await c
    .from("atividades")
    .update(camposExecucao(concluida, dados))
    .eq("id", atividadeId)
    .eq("turno_id", turnoId)
    .select("id");
  if (error) {
    console.error("salvarExecucaoPlanejador:", error.message);
    return falha(ERRO_GENERICO);
  }
  if (!data || data.length === 0) return falha("Atividade não encontrada");
  return ok(undefined);
}

export async function salvarEfetivoPlanejador(c: SupabaseClient, turnoId: string, linhas: LinhaEfetivo[]): Promise<Resultado> {
  const v = validarEfetivo(linhas);
  if (!v.ok) return v;
  const t = await turnoAbertoParaCorrecao(c, turnoId);
  if (!t.ok) return t;
  const { error: ed } = await c.from("efetivo").delete().eq("turno_id", turnoId);
  if (ed) {
    console.error("salvarEfetivoPlanejador (delete):", ed.message);
    return falha(ERRO_GENERICO);
  }
  if (v.dados.length === 0) return ok(undefined);
  const { error: ei } = await c.from("efetivo").insert(v.dados.map((l) => ({ ...l, turno_id: turnoId })));
  if (ei) {
    // Efetivo já apagado: lançar para o cliente repetir o envio (ver campo.ts).
    console.error("salvarEfetivoPlanejador (insert):", ei.message);
    throw new Error("salvarEfetivoPlanejador: falha ao gravar o efetivo");
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
    return falha(ERRO_GENERICO);
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
    return falha(ERRO_GENERICO);
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
    return falha(ERRO_GENERICO);
  }
  if (!data || data.length === 0) return falha("Turno não encontrado");
  return ok(undefined);
}
