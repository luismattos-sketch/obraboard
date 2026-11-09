import "server-only";
import { statusAtividade } from "@/lib/dominio/calculos";
import { hashToken } from "@/lib/dominio/token";
import type { Causa, CondicaoClima, PeriodoClima, StatusTurno } from "@/lib/dominio/tipos";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { falha, ok, type Resultado } from "./resultado";
import { aplicarAcao, obterTurnoCompleto, type TurnoCompleto } from "./turnos";
import { camposExecucao, validarClima, validarEfetivo, validarExecucao, validarHorario, validarPeriodoClima } from "./validacao";

/**
 * Acesso do encarregado por link secreto. Usa o cliente admin (ignora RLS):
 * TODA consulta aqui é escopada ao turno resolvido pelo hash do token.
 */

export const ERRO_LINK = "Link inválido ou substituído. Peça um novo link ao planejador.";
export const ERRO_FECHADO = "Este turno não está aberto para lançamentos.";
export const ERRO_ATIVIDADE = "Esta atividade foi removida pelo planejador. Recarregue a página.";
const ERRO_GENERICO = "Não foi possível salvar. Tente novamente.";

const TOKEN_FORMATO = /^[A-Za-z0-9_-]{43}$/;

/** Resolve o id/status do turno do token; nunca confia em ids vindos do cliente. */
async function resolverTurno(token: string): Promise<{ id: string; status: StatusTurno } | null> {
  if (typeof token !== "string" || !TOKEN_FORMATO.test(token)) return null;
  const { data, error } = await criarClienteAdmin()
    .from("turnos")
    .select("id, status")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error) {
    console.error("resolverTurno:", error.message);
    throw new Error("resolverTurno");
  }
  return data ? (data as { id: string; status: StatusTurno }) : null;
}

/** Turno do token aberto para lançamentos (em_campo ou enviado). */
async function turnoAberto(token: string): Promise<Resultado<{ id: string; status: StatusTurno }>> {
  const t = await resolverTurno(token);
  if (!t) return falha(ERRO_LINK);
  if (t.status !== "em_campo" && t.status !== "enviado") return falha(ERRO_FECHADO);
  return ok(t);
}

export async function obterTurnoPorToken(token: string): Promise<TurnoCompleto | null> {
  const t = await resolverTurno(token);
  if (!t) return null;
  return obterTurnoCompleto(criarClienteAdmin(), t.id);
}

export async function salvarExecucao(
  token: string,
  atividadeId: string,
  dados: { qtd_realizada: number | null; causa: Causa | null; observacao: string | null },
): Promise<Resultado> {
  const v = validarExecucao(dados);
  if (!v.ok) return v;

  const t = await turnoAberto(token);
  if (!t.ok) return t;
  const admin = criarClienteAdmin();

  const { data: at, error: ea } = await admin
    .from("atividades")
    .select("id, qtd_planejada")
    .eq("id", atividadeId)
    .eq("turno_id", t.dados.id)
    .maybeSingle();
  if (ea && ea.code !== "22P02") {
    console.error("salvarExecucao (leitura):", ea.message);
    return falha(ERRO_GENERICO);
  }
  if (!at) return falha(ERRO_ATIVIDADE);

  const concluida = statusAtividade(Number(at.qtd_planejada), dados.qtd_realizada) === "concluida";
  const { data, error } = await admin
    .from("atividades")
    .update(camposExecucao(concluida, dados))
    .eq("id", atividadeId)
    .eq("turno_id", t.dados.id)
    .select("id");
  if (error) {
    console.error("salvarExecucao:", error.message);
    return falha(ERRO_GENERICO);
  }
  if (!data || data.length === 0) return falha(ERRO_ATIVIDADE);
  return ok(undefined);
}

export async function salvarEfetivo(
  token: string,
  linhas: { funcao: string; quantidade: number }[],
): Promise<Resultado> {
  const v = validarEfetivo(linhas);
  if (!v.ok) return v;
  const limpas = v.dados;

  const t = await turnoAberto(token);
  if (!t.ok) return t;
  const admin = criarClienteAdmin();
  const { error: ed } = await admin.from("efetivo").delete().eq("turno_id", t.dados.id);
  if (ed) {
    console.error("salvarEfetivo (delete):", ed.message);
    return falha(ERRO_GENERICO);
  }
  if (limpas.length === 0) return ok(undefined);
  const { error: ei } = await admin.from("efetivo").insert(limpas.map((l) => ({ ...l, turno_id: t.dados.id })));
  if (ei) {
    // O efetivo já foi apagado: lançar para o cliente repetir o envio (rede) em vez de mostrar "salvo".
    console.error("salvarEfetivo (insert):", ei.message);
    throw new Error("salvarEfetivo: falha ao gravar o efetivo");
  }
  return ok(undefined);
}

export async function salvarClima(
  token: string,
  dados: { periodo: PeriodoClima; condicao: CondicaoClima; impediu: boolean },
): Promise<Resultado> {
  const v = validarClima(dados);
  if (!v.ok) return v;
  const t = await turnoAberto(token);
  if (!t.ok) return t;
  const { error } = await criarClienteAdmin()
    .from("clima")
    .upsert(
      { turno_id: t.dados.id, periodo: dados.periodo, condicao: dados.condicao, impediu: dados.impediu === true },
      { onConflict: "turno_id,periodo" },
    );
  if (error) {
    console.error("salvarClima:", error.message);
    return falha(ERRO_GENERICO);
  }
  return ok(undefined);
}

export async function removerClima(token: string, periodo: PeriodoClima): Promise<Resultado> {
  const v = validarPeriodoClima(periodo);
  if (!v.ok) return v;
  const t = await turnoAberto(token);
  if (!t.ok) return t;
  const { error } = await criarClienteAdmin().from("clima").delete().eq("turno_id", t.dados.id).eq("periodo", periodo);
  if (error) {
    console.error("removerClima:", error.message);
    return falha(ERRO_GENERICO);
  }
  return ok(undefined);
}

export async function salvarHorarioReal(
  token: string,
  dados: { hora_inicio_real: string | null; hora_fim_real: string | null },
): Promise<Resultado> {
  const v = validarHorario(dados);
  if (!v.ok) return v;
  const t = await turnoAberto(token);
  if (!t.ok) return t;
  const { error } = await criarClienteAdmin()
    .from("turnos")
    .update({ hora_inicio_real: dados.hora_inicio_real, hora_fim_real: dados.hora_fim_real })
    .eq("id", t.dados.id);
  if (error) {
    console.error("salvarHorarioReal:", error.message);
    return falha(ERRO_GENERICO);
  }
  return ok(undefined);
}

export async function enviarTurnoCampo(token: string): Promise<Resultado<{ status: StatusTurno }>> {
  const t = await turnoAberto(token);
  if (!t.ok) return t;
  if (t.dados.status === "enviado") return ok({ status: "enviado" });
  const r = await aplicarAcao(criarClienteAdmin(), t.dados.id, "enviar");
  if (!r.ok) return r;
  return ok({ status: r.dados.status });
}
