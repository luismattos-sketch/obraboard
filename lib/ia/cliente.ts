import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { ESQUEMA_RESPOSTA, lerRespostaIA, montarPedido, type AtividadeParaIA, type RespostaIA } from "./esquema";
import { respostaFalsa } from "./falsa";

const MODELO = "claude-haiku-5-5";

const modoFalso = () => process.env.FRENTIA_IA_FALSA === "1";

/** A caixa "Conte como foi o dia" só aparece com a IA ligada. */
export function iaLigada(): boolean {
  return modoFalso() || Boolean(process.env.ANTHROPIC_API_KEY);
}

export type ResultadoIA = { ok: true; resposta: RespostaIA } | { ok: false; motivo: "indisponivel" | "invalida" };

let cliente: Anthropic | null = null;

/** A IA só interpreta o relato em formato fixo; nunca grava nada. */
export async function interpretarRelato(texto: string, atividades: AtividadeParaIA[]): Promise<ResultadoIA> {
  if (modoFalso()) {
    try {
      return { ok: true, resposta: respostaFalsa(texto, atividades) };
    } catch {
      return { ok: false, motivo: "indisponivel" };
    }
  }
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, motivo: "indisponivel" };
  cliente ??= new Anthropic({ timeout: 20_000, maxRetries: 0 });
  const { system, user } = montarPedido(texto, atividades);
  let resposta: Anthropic.Message;
  try {
    resposta = await cliente.messages.create({
      model: MODELO,
      max_tokens: 2000,
      output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA_RESPOSTA } },
      system,
      messages: [{ role: "user", content: user }],
    });
  } catch (e) {
    // Nunca logar o relato (texto do usuário).
    const status = e instanceof Anthropic.APIError ? e.status : undefined;
    console.error("interpretarRelato: falha na IA", status ?? (e instanceof Error ? e.name : "erro"));
    return { ok: false, motivo: "indisponivel" };
  }
  if (resposta.stop_reason !== "end_turn") {
    console.error("interpretarRelato: parada", resposta.stop_reason);
    return { ok: false, motivo: "invalida" };
  }
  const texto_ = resposta.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  let json: unknown;
  try {
    json = JSON.parse(texto_);
  } catch {
    return { ok: false, motivo: "invalida" };
  }
  const lida = lerRespostaIA(json);
  return lida ? { ok: true, resposta: lida } : { ok: false, motivo: "invalida" };
}
