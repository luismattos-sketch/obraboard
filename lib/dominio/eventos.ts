import { falha, ok, type Resultado } from "@/lib/db/resultado";

export const ERRO_MOTIVO = "Informe o motivo da reabertura";
export const ERRO_MOTIVO_LONGO = "O motivo pode ter até 500 caracteres";
const MOTIVO_MIN = 3;
const MOTIVO_MAX = 500;

/** Motivo da reabertura: obrigatório, de 3 a 500 caracteres depois do trim (o banco confere de novo). */
export function validarMotivo(texto: unknown): Resultado<string> {
  const m = typeof texto === "string" ? texto.trim() : "";
  if (m.length < MOTIVO_MIN) return falha(ERRO_MOTIVO);
  if (m.length > MOTIVO_MAX) return falha(ERRO_MOTIVO_LONGO);
  return ok(m);
}
