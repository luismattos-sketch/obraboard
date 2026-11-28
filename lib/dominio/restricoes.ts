// Item 5.2: restrições dos itens do lookahead (regras puras, testáveis).
import { CAUSAS, type Causa } from "./tipos";

export type Restricao = {
  id: string;
  cronograma_item_id: string;
  tipo: Causa;
  descricao: string;
  responsavel: string;
  prazo: string | null;
  removida_em: string | null;
  created_at: string;
};

export type DadosRestricao = { tipo: string; descricao: string; responsavel: string; prazo?: string | null };
export type RestricaoValida = { tipo: Causa; descricao: string; responsavel: string; prazo: string | null };

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const dataValida = (s: string) => {
  if (!DATA.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

export function validarRestricao(
  d: DadosRestricao,
): { ok: true; dados: RestricaoValida } | { ok: false; erro: string; campos: Record<string, string> } {
  const campos: Record<string, string> = {};
  const tipo = d.tipo in CAUSAS ? (d.tipo as Causa) : null;
  if (!tipo) campos.tipo = "Escolha o tipo";
  const descricao = (d.descricao ?? "").trim();
  if (!descricao) campos.descricao = "Descreva a restrição";
  else if (descricao.length > 300) campos.descricao = "Descrição muito longa (até 300 letras)";
  const responsavel = (d.responsavel ?? "").trim();
  if (!responsavel) campos.responsavel = "Informe o responsável";
  else if (responsavel.length > 100) campos.responsavel = "Nome do responsável muito longo (até 100 letras)";
  const prazo = (d.prazo ?? "").trim() || null;
  if (prazo && !dataValida(prazo)) campos.prazo = "Prazo inválido";
  const primeira = Object.values(campos)[0];
  if (primeira) return { ok: false, erro: primeira, campos };
  return { ok: true, dados: { tipo: tipo!, descricao, responsavel, prazo } };
}

export const restricaoVencida = (r: Pick<Restricao, "prazo" | "removida_em">, hoje: string) =>
  !r.removida_em && !!r.prazo && r.prazo < hoje;

export function resumoRestricoes(lista: Pick<Restricao, "prazo" | "removida_em">[], hoje: string) {
  const abertas = lista.filter((r) => !r.removida_em);
  return { abertas: abertas.length, vencidas: abertas.filter((r) => restricaoVencida(r, hoje)).length };
}

/** Abertas primeiro (prazo mais cedo antes; sem prazo no fim), depois removidas (mais recente antes). */
export function ordenarRestricoes<T extends Pick<Restricao, "prazo" | "removida_em" | "created_at">>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    if (!a.removida_em !== !b.removida_em) return a.removida_em ? 1 : -1;
    if (a.removida_em && b.removida_em) return b.removida_em.localeCompare(a.removida_em);
    if (a.prazo !== b.prazo) return a.prazo === null ? 1 : b.prazo === null ? -1 : a.prazo.localeCompare(b.prazo);
    return a.created_at.localeCompare(b.created_at);
  });
}
