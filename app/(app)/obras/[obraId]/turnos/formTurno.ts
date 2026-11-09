import { falha, type Resultado } from "@/lib/db/resultado";
import type { DadosTurno } from "@/lib/db/turnos";

export type EstadoFormTurno = (Resultado<undefined> & { valores?: Record<string, string>; envio?: number }) | null;

const CAMPOS = ["data", "periodo", "hora_inicio_prevista", "hora_fim_prevista"] as const;
const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Lê os campos de turno do formulário; a falha devolve o que foi digitado (React 19 limpa o form). */
export function lerFormTurno(form: FormData): {
  dados?: DadosTurno;
  falhar: (erro: string) => EstadoFormTurno;
} {
  const valores: Record<string, string> = {};
  for (const k of CAMPOS) valores[k] = texto(form, k);
  const falhar = (erro: string): EstadoFormTurno => ({ ...falha(erro), valores, envio: Date.now() });
  const periodo = valores.periodo;
  if (periodo !== "diurno" && periodo !== "noturno") return { falhar };
  return {
    dados: {
      data: valores.data,
      periodo,
      hora_inicio_prevista: valores.hora_inicio_prevista || null,
      hora_fim_prevista: valores.hora_fim_prevista || null,
    },
    falhar,
  };
}
