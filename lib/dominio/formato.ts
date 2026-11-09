import type { Periodo, StatusTurno } from "./tipos";
import type { Tom } from "@/components/ui/tons";

/** "2026-11-08" -> "08/11/2026" */
export function dataBR(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export const ROTULO_PERIODO: Record<Periodo, string> = { diurno: "Diurno", noturno: "Noturno" };

export const TOM_STATUS_TURNO: Record<StatusTurno, Tom> = {
  planejado: "neutro",
  em_campo: "info",
  enviado: "alerta",
  fechado: "sucesso",
};

export const numeroBR = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

/** "07:00:00" -> "07:00" */
export const horaCurta = (h: string | null) => (h ? h.slice(0, 5) : "");
