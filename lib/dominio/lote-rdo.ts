import { agruparVersoes, normalizarMes, type ItemVersao } from "./historico-rdo";
import { compararTurnos } from "./regras";

/** Máximo de RDOs num único PDF. */
export const LIMITE_LOTE = 120;

/** Um RDO do lote: a versão atual do turno e, se houver, a que ela substitui. */
export type ItemLote = {
  atual: ItemVersao;
  reaberto: boolean;
  anterior?: { numero: number; emitido_em: string };
};

/**
 * Versão atual de cada turno do mês (e da obra, se dada), em ordem de obra e depois data/período.
 * A obra é agrupada pelo id e rotulada pelo nome do RDO mais recente dela (renomear não separa).
 */
export function selecionarLote(itens: ItemVersao[], mes: string, obraId: string | null): ItemLote[] {
  const lote: ItemLote[] = agruparVersoes(itens, mes)
    .filter((g) => obraId === null || g.obraId === obraId)
    .map((g) => {
      const ant = g.anteriores.find((v) => v.numero === g.atual.numero - 1);
      const l: ItemLote = { atual: g.atual, reaberto: g.reaberto };
      if (ant) l.anterior = { numero: ant.numero, emitido_em: ant.emitidoEm };
      return l;
    });

  const rotulo = new Map<string, { nome: string; em: string }>();
  for (const { atual } of lote) {
    const r = rotulo.get(atual.obraId);
    if (!r || atual.emitidoEm > r.em) rotulo.set(atual.obraId, { nome: atual.obraNome, em: atual.emitidoEm });
  }
  const nome = (id: string) => rotulo.get(id)!.nome;

  return lote.sort(
    (a, b) =>
      nome(a.atual.obraId).localeCompare(nome(b.atual.obraId), "pt-BR") ||
      (a.atual.obraId < b.atual.obraId ? -1 : a.atual.obraId > b.atual.obraId ? 1 : 0) ||
      compararTurnos(a.atual, b.atual),
  );
}

/** Página (1-based, no arquivo final) onde cada RDO começa, depois da capa. */
export function paginasIniciais(paginasCapa: number, paginasPorRdo: number[]): number[] {
  const inicios: number[] = [];
  let proxima = paginasCapa + 1;
  for (const n of paginasPorRdo) {
    inicios.push(proxima);
    proxima += n;
  }
  return inicios;
}

/**
 * Para onde o login volta quando a sessão expirou no clique do PDF único: a lista de onde ele saiu.
 * Voltar direto para a rota do PDF faria o servidor gerá-lo várias vezes (pré-busca da action + RSC + download).
 */
export function retornoDoLote(mes: unknown, obra: unknown): string {
  const base = typeof obra === "string" && /^[0-9a-zA-Z-]+$/.test(obra) ? `/obras/${obra}/rdos` : "/rdos";
  const m = normalizarMes(mes);
  return m ? `${base}?mes=${m}` : base;
}
