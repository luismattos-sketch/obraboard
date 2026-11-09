import "server-only";
import { statusAtividade } from "@/lib/dominio/calculos";
import { hashToken } from "@/lib/dominio/token";
import { CAUSAS, CONDICOES, type Causa, type CondicaoClima, type PeriodoClima, type StatusTurno } from "@/lib/dominio/tipos";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { falha, ok, type Resultado } from "./resultado";
import { aplicarAcao, obterTurnoCompleto, type TurnoCompleto } from "./turnos";

/**
 * Acesso do encarregado por link secreto. Usa o cliente admin (ignora RLS):
 * TODA consulta aqui é escopada ao turno resolvido pelo hash do token.
 */

export const ERRO_LINK = "Link inválido ou substituído. Peça um novo link ao planejador.";
export const ERRO_FECHADO = "Este turno não está aberto para lançamentos.";
export const ERRO_ATIVIDADE = "Esta atividade foi removida pelo planejador. Recarregue a página.";
const ERRO_GENERICO = "Não foi possível salvar. Tente novamente.";

const TOKEN_FORMATO = /^[A-Za-z0-9_-]{43}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const PERIODOS_CLIMA: PeriodoClima[] = ["manha", "tarde", "noite"];

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
  const q = dados.qtd_realizada;
  if (q !== null && !(typeof q === "number" && Number.isFinite(q) && q >= 0 && q < 1e12)) {
    return falha("Quantidade realizada inválida");
  }
  if (dados.causa !== null && !(typeof dados.causa === "string" && Object.hasOwn(CAUSAS, dados.causa))) {
    return falha("Causa inválida");
  }
  if (dados.observacao !== null && (typeof dados.observacao !== "string" || dados.observacao.length > 500)) {
    return falha("Observação deve ter no máximo 500 caracteres");
  }

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

  const concluida = statusAtividade(Number(at.qtd_planejada), q) === "concluida";
  const observacao = dados.observacao?.trim() ? dados.observacao.trim() : null;
  const { data, error } = await admin
    .from("atividades")
    .update({
      qtd_realizada: q,
      causa: concluida ? null : dados.causa,
      observacao: concluida ? null : observacao,
    })
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
  if (!Array.isArray(linhas) || linhas.length > 50) return falha("Efetivo inválido");
  const limpas: { funcao: string; quantidade: number }[] = [];
  for (const l of linhas) {
    const funcao = typeof l?.funcao === "string" ? l.funcao.trim() : "";
    if (!funcao || funcao.length > 60) return falha("Informe a função (até 60 caracteres)");
    if (!Number.isInteger(l.quantidade) || l.quantidade < 1 || l.quantidade > 999) {
      return falha("Quantidade deve ser um número inteiro entre 1 e 999");
    }
    limpas.push({ funcao, quantidade: l.quantidade });
  }

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
    console.error("salvarEfetivo (insert):", ei.message);
    return falha(ERRO_GENERICO);
  }
  return ok(undefined);
}

export async function salvarClima(
  token: string,
  dados: { periodo: PeriodoClima; condicao: CondicaoClima; impediu: boolean },
): Promise<Resultado> {
  if (!PERIODOS_CLIMA.includes(dados.periodo)) return falha("Período do clima inválido");
  if (typeof dados.condicao !== "string" || !Object.hasOwn(CONDICOES, dados.condicao)) {
    return falha("Condição do clima inválida");
  }
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

export async function salvarHorarioReal(
  token: string,
  dados: { hora_inicio_real: string | null; hora_fim_real: string | null },
): Promise<Resultado> {
  for (const h of [dados.hora_inicio_real, dados.hora_fim_real]) {
    if (h !== null && !(typeof h === "string" && HORA.test(h))) return falha("Horário inválido");
  }
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
