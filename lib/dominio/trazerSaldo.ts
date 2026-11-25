import { qtdComUnidade } from "./plural";
import type { AtividadeResumida, ResumoSemana } from "./programacao";
import { agruparSequencias } from "./sequencia";

/**
 * Item 1.6 (decidido em 2026-11-24): o que ficou com saldo na semana anterior volta para a programação
 * seguinte pelo botão "Trazer". Sequência do item 19 conta como um item só: saldo = Σ metas − Σ realizado;
 * os dados vêm do último membro (o turno que fica com o saldo).
 */
export type PendenteAnterior = { origem: AtividadeResumida; metaTotal: number; realizado: number; saldo: number };

const arred = (x: number) => Math.round(x * 100) / 100;

function pendenteDo(grupo: AtividadeResumida[]): PendenteAnterior {
  const metaTotal = arred(grupo.reduce((s, a) => s + a.meta, 0));
  const realizado = arred(grupo.reduce((s, a) => s + a.realizado, 0));
  return { origem: grupo[grupo.length - 1], metaTotal, realizado, saldo: Math.max(arred(metaTotal - realizado), 0) };
}

export function pendentesDaSemanaAnterior(resumo: ResumoSemana): PendenteAnterior[] {
  return agruparSequencias(resumo.atividades).map(pendenteDo).filter((p) => p.saldo > 0);
}

/** Saldo atual do grupo (atividade ou sequência) que contém `origemId`; null se não existe mais. */
export function saldoDaOrigem(resumo: ResumoSemana, origemId: string): number | null {
  const grupo = agruparSequencias(resumo.atividades).find((g) => g.some((a) => a.id === origemId));
  return grupo ? pendenteDo(grupo).saldo : null;
}

export function textoSaldoMudou(saldoTrazido: number, saldoAtual: number, unidade: string | null): string | null {
  if (arred(saldoTrazido) === arred(saldoAtual)) return null;
  const era = qtdComUnidade(saldoTrazido, unidade);
  if (saldoAtual <= 0) return `A semana anterior concluiu esta atividade (era ${era}). Apague-a se não for mais necessária.`;
  return `Saldo da semana anterior mudou: era ${era}, agora ${qtdComUnidade(saldoAtual, unidade)}.`;
}
