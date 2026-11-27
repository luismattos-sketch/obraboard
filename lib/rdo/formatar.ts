import { numeroBR } from "@/lib/dominio/formato";
import { ROTULO_TIPO, type TipoAtividade } from "@/lib/dominio/tipos";

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

/**
 * Item 17: agrupa atividades e efetivo por responsável, na ordem em que aparecem; "Sem responsável" por último.
 * Fotos antigas sem `responsavel_id` caem em "Sem responsável".
 */
export function porResponsavel<A extends { responsavel_id?: string | null }, E extends { responsavel_id?: string | null }>(
  atividades: A[],
  efetivo: E[],
): { id: string | null; atividades: A[]; efetivo: E[] }[] {
  const grupos = new Map<string | null, { id: string | null; atividades: A[]; efetivo: E[] }>();
  const grupo = (id: string | null) => {
    if (!grupos.has(id)) grupos.set(id, { id, atividades: [], efetivo: [] });
    return grupos.get(id)!;
  };
  for (const a of atividades) grupo(a.responsavel_id ?? null).atividades.push(a);
  for (const e of efetivo) grupo(e.responsavel_id ?? null).efetivo.push(e);
  return [...grupos.values()].sort((x, y) => Number(x.id === null) - Number(y.id === null));
}

/** Descrição no RDO com a marca do tipo: "Extra · Troca de iluminação". */
export const descricaoComTipo = (a: { descricao: string; tipo?: TipoAtividade | null }) =>
  a.tipo ? `${ROTULO_TIPO[a.tipo]} · ${a.descricao}` : a.descricao;
