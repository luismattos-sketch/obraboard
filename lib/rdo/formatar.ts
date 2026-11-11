import { numeroBR } from "@/lib/dominio/formato";

const FUSO = "America/Sao_Paulo";

/** "08/11/2026 às 18:30" no horário de Brasília. */
export function dataHoraBrasilia(d: Date): string {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? "";
  return `${p("day")}/${p("month")}/${p("year")} às ${p("hour")}:${p("minute")}`;
}

/** "09/11 às 18:40" no horário de Brasília (listas e botões). */
export function dataHoraCurta(d: Date): string {
  return dataHoraBrasilia(d).replace(/^(\d{2}\/\d{2})\/\d{4}/, "$1");
}

/** Quantidade realizada: nula (não apontada) aparece como "—", nunca "0". */
export const qtdRealizada = (q: number | null, unidade: string) => (q === null ? "—" : `${numeroBR(q)} ${unidade}`);
