import "server-only";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { turnoAberto } from "./campo";
import { aplicarAcao } from "./turnos";
import { errosDeCausa } from "@/lib/dominio/regras";
import type { AtividadeExec } from "@/lib/dominio/tipos";
import { ERRO_CAUSA_TERMINEI, ERRO_FECHADO_CAMPO, ERRO_RESPONSAVEL_INVALIDO, erroBanco } from "./mensagens";
import { falha, ok, type Resultado } from "./resultado";
import { horaValida } from "./validacao";

/** "Terminei minha parte": um registro por equipe e turno (campo, cliente admin escopado ao turno do token). */

const ERRO_GENERICO = "Não foi possível salvar. Tente novamente.";

function traduzir(error: { code?: string; message?: string }): Resultado<never> {
  const b = erroBanco(error);
  if (b === "turno_fechado") return falha(ERRO_FECHADO_CAMPO);
  if (b === "responsavel_invalido" || error.code === "22P02" || error.code === "23503") return falha(ERRO_RESPONSAVEL_INVALIDO);
  console.error("terminados:", error.message);
  return falha(ERRO_GENERICO);
}

type Admin = ReturnType<typeof criarClienteAdmin>;

/**
 * Envio automático: quando todos os responsáveis com atividade no turno terminaram, o turno vai a "enviado".
 * Atividade sem responsável impede (ninguém a termina; o planejador fecha). Falha só loga: o Terminei vale.
 */
async function sincronizarEnvio(admin: Admin, turnoId: string): Promise<void> {
  const [{ data: ats, error: ea }, { data: fim, error: ef }, { data: tu, error: et }] = await Promise.all([
    admin.from("atividades").select("responsavel_id").eq("turno_id", turnoId),
    admin.from("turno_equipes_terminadas").select("responsavel_id").eq("turno_id", turnoId),
    admin.from("turnos").select("status").eq("id", turnoId).single(),
  ]);
  if (ea || ef || et) {
    console.error("sincronizarEnvio:", (ea ?? ef ?? et)!.message);
    return;
  }
  if (tu.status !== "em_campo") return;
  const donos = (ats ?? []).map((a) => a.responsavel_id as string | null);
  if (donos.length === 0 || donos.some((d) => d === null)) return;
  const terminaram = new Set((fim ?? []).map((x) => x.responsavel_id as string));
  if (!donos.every((d) => terminaram.has(d!))) return;
  const r = await aplicarAcao(admin, turnoId, "enviar");
  if (!r.ok) console.error("sincronizarEnvio (enviar):", r.erro);
}

/** Repetir (envio sem resposta) é sucesso: o horário já gravado vale. */
export async function marcarTerminouCampo(token: string, responsavelId: string, hora: string): Promise<Resultado> {
  if (!horaValida(hora)) return falha("Informe o horário");
  const t = await turnoAberto(token);
  if (!t.ok) return t;
  const admin = criarClienteAdmin();
  const { data: ats, error: ea } = await admin
    .from("atividades")
    .select("id, descricao, qtd_planejada, qtd_realizada, causa, observacao, tipo")
    .eq("turno_id", t.dados.id)
    .eq("responsavel_id", responsavelId);
  if (ea) return traduzir(ea);
  if (Object.keys(errosDeCausa((ats ?? []) as AtividadeExec[])).length > 0) return falha(ERRO_CAUSA_TERMINEI);
  const { error } = await admin
    .from("turno_equipes_terminadas")
    .insert({ turno_id: t.dados.id, responsavel_id: responsavelId, terminou_em: hora });
  if (error && error.code !== "23505") return traduzir(error);
  await sincronizarEnvio(admin, t.dados.id);
  return ok(undefined);
}

export async function desfazerTerminouCampo(token: string, responsavelId: string): Promise<Resultado> {
  const t = await turnoAberto(token);
  if (!t.ok) return t;
  const admin = criarClienteAdmin();
  const { error } = await admin
    .from("turno_equipes_terminadas")
    .delete()
    .eq("turno_id", t.dados.id)
    .eq("responsavel_id", responsavelId);
  if (error) return traduzir(error);
  // Alguém voltou a trabalhar: o turno deixa de estar enviado.
  const { error: ev } = await admin
    .from("turnos")
    .update({ status: "em_campo", enviado_em: null })
    .eq("id", t.dados.id)
    .eq("status", "enviado");
  if (ev) return traduzir(ev);
  return ok(undefined);
}
