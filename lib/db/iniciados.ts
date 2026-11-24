import "server-only";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { turnoAberto } from "./campo";
import { sincronizarHorarioReal } from "./horarioReal";
import { ERRO_FECHADO_CAMPO, ERRO_RESPONSAVEL_INVALIDO, erroBanco } from "./mensagens";
import { falha, ok, type Resultado } from "./resultado";
import { horaValida } from "./validacao";

/** "Iniciar turno": um registro por equipe e turno (campo, cliente admin escopado ao turno do token). */

const ERRO_GENERICO = "Não foi possível salvar. Tente novamente.";

function traduzir(error: { code?: string; message?: string }): Resultado<never> {
  const b = erroBanco(error);
  if (b === "turno_fechado") return falha(ERRO_FECHADO_CAMPO);
  if (b === "responsavel_invalido" || error.code === "22P02" || error.code === "23503") return falha(ERRO_RESPONSAVEL_INVALIDO);
  console.error("iniciados:", error.message);
  return falha(ERRO_GENERICO);
}

/** Repetir (envio sem resposta) é sucesso: o horário já gravado vale. */
export async function marcarIniciouCampo(token: string, responsavelId: string, hora: string): Promise<Resultado> {
  if (!horaValida(hora)) return falha("Informe o horário");
  const t = await turnoAberto(token);
  if (!t.ok) return t;
  const admin = criarClienteAdmin();
  const { error } = await admin
    .from("turno_equipes_iniciadas")
    .insert({ turno_id: t.dados.id, responsavel_id: responsavelId, iniciou_em: hora });
  if (error && error.code !== "23505") return traduzir(error);
  await sincronizarHorarioReal(admin, t.dados.id);
  return ok(undefined);
}

export async function desfazerIniciouCampo(token: string, responsavelId: string): Promise<Resultado> {
  const t = await turnoAberto(token);
  if (!t.ok) return t;
  const admin = criarClienteAdmin();
  const { error } = await admin
    .from("turno_equipes_iniciadas")
    .delete()
    .eq("turno_id", t.dados.id)
    .eq("responsavel_id", responsavelId);
  if (error) return traduzir(error);
  await sincronizarHorarioReal(admin, t.dados.id);
  return ok(undefined);
}
