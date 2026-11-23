import "server-only";
import { codigosParaIA, conferirRelato, type AtividadeRelato, type Previa } from "@/lib/dominio/relato";
import { iaLigada, interpretarRelato } from "@/lib/ia/cliente";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { turnoAberto } from "./campo";
import { ERRO_IA_INDISPONIVEL, ERRO_RESPONSAVEL_INVALIDO } from "./mensagens";
import { gravarTentativa, marcarLancado } from "./relatos";
import { falha, ok, type Resultado } from "./resultado";

// "Conte como foi o dia" pelo link de campo. Separado de campo.ts para que só esta rota carregue o SDK da IA.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Guarda o texto (antes da IA), interpreta e confere contra as atividades do responsável. Nada é gravado nelas. */
export async function organizarRelatoCampo(
  token: string,
  responsavelId: string,
  texto: string,
  relatoId: string | null,
): Promise<Resultado<{ relatoId: string; previa: Previa }>> {
  const t = await turnoAberto(token);
  if (!t.ok) return t;
  if (typeof responsavelId !== "string" || !UUID.test(responsavelId)) return falha(ERRO_RESPONSAVEL_INVALIDO);
  const relato = await gravarTentativa(t.dados.id, responsavelId, texto, relatoId && UUID.test(relatoId) ? relatoId : null);
  if (!relato.ok) return relato;

  const { data, error } = await criarClienteAdmin()
    .from("atividades")
    .select("id, descricao, local, unidade, qtd_planejada, qtd_realizada, causa, observacao, tipo")
    .eq("turno_id", t.dados.id)
    .eq("responsavel_id", responsavelId)
    .order("ordem");
  if (error) {
    console.error("organizarRelatoCampo:", error.message);
    return falha(ERRO_IA_INDISPONIVEL);
  }
  const atividades = (data ?? []).map((a) => ({ ...a, qtd_planejada: Number(a.qtd_planejada), qtd_realizada: a.qtd_realizada === null ? null : Number(a.qtd_realizada) })) as AtividadeRelato[];
  if (!iaLigada()) return falha(ERRO_IA_INDISPONIVEL);
  const paraIA = [...codigosParaIA(atividades).entries()].map(([codigo, a]) => ({
    codigo, descricao: a.descricao, local: a.local, unidade: a.unidade,
    meta: a.tipo === "extra" ? null : a.qtd_planejada, feito: a.qtd_realizada, tipo: a.tipo ?? null,
  }));
  const r = await interpretarRelato(texto.trim(), paraIA);
  if (!r.ok) return falha(ERRO_IA_INDISPONIVEL);
  return ok({ relatoId: relato.dados.id, previa: conferirRelato(r.resposta, atividades, texto.trim()) });
}

/** O responsável tocou "Lançar" (as atividades são gravadas uma a uma pelo salvarExecucao). */
export async function lancarRelatoCampo(token: string, responsavelId: string, relatoId: string): Promise<Resultado> {
  const t = await turnoAberto(token);
  if (!t.ok) return t;
  if (!UUID.test(responsavelId) || !UUID.test(relatoId)) return falha(ERRO_RESPONSAVEL_INVALIDO);
  return marcarLancado(t.dados.id, responsavelId, relatoId);
}
