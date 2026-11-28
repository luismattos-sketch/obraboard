// Item 5.3: atividade com restrição aberta só entra na semana com motivo (regras puras).
import type { Restricao } from "./restricoes";
import type { Situacao } from "./programacao";

type RestricaoDoItem = Pick<Restricao, "descricao" | "responsavel" | "prazo" | "removida_em">;
export type RestricoesPorItem = Map<string, RestricaoDoItem[]>;

export function restricoesAbertasDoItem(itemId: string | null | undefined, porItem: RestricoesPorItem) {
  if (!itemId) return [];
  return (porItem.get(itemId) ?? [])
    .filter((r) => !r.removida_em)
    .map(({ descricao, responsavel, prazo }) => ({ descricao, responsavel, prazo }));
}

export function pendentesDeMotivo(
  atividades: { id: string; descricao: string; cronograma_item_id?: string | null; justificativa_restricao?: string | null }[],
  porItem: RestricoesPorItem,
): { id: string; descricao: string; restricoes: string[] }[] {
  return atividades.flatMap((a) => {
    if (a.justificativa_restricao) return [];
    const abertas = restricoesAbertasDoItem(a.cronograma_item_id, porItem);
    return abertas.length ? [{ id: a.id, descricao: a.descricao, restricoes: abertas.map((r) => r.descricao) }] : [];
  });
}

export function validarMotivo(t: string | null | undefined): string | null {
  const s = (t ?? "").trim();
  return s && s.length <= 300 ? s : null;
}

export function resumoComRestricao(atividades: { situacao: Situacao; justificativa_restricao?: string | null }[]) {
  const com = atividades.filter((a) => a.justificativa_restricao);
  return { total: com.length, cumpridas: com.filter((a) => a.situacao === "cumprida").length };
}
