import { numeroBR } from "./formato";
import { CAUSAS, type Causa } from "./tipos";

/** Execução de uma atividade no formato gravado no banco (base da checagem otimista). */
export type ValoresExecucao = { qtd_realizada: number | null; causa: Causa | null; observacao: string | null };

export const PREFIXO_CONFLITO = "Mudou em outra tela (pode ter sido você em outra aba).";

/** Explica o que está gravado agora × o que esta tela tentou gravar. */
export function textoConflitoExecucao(atual: ValoresExecucao, digitado: ValoresExecucao, unidade: string): string {
  const partes = [PREFIXO_CONFLITO];
  if (atual.qtd_realizada !== digitado.qtd_realizada) {
    const agora = atual.qtd_realizada === null ? "em branco" : `${numeroBR(atual.qtd_realizada)} ${unidade}`;
    const antes = digitado.qtd_realizada === null ? "deixado em branco" : `digitado ${numeroBR(digitado.qtd_realizada)}`;
    partes.push(`Agora está ${agora}, você tinha ${antes}.`);
  }
  if (atual.causa !== digitado.causa) {
    const agora = atual.causa === null ? "está sem causa" : `a causa é ${CAUSAS[atual.causa]}`;
    const antes = digitado.causa === null ? "deixado sem causa" : `escolhido ${CAUSAS[digitado.causa]}`;
    partes.push(`Agora ${agora}, você tinha ${antes}.`);
  }
  if ((atual.observacao ?? "") !== (digitado.observacao?.trim() ?? "")) partes.push("A observação também foi alterada.");
  return partes.join(" ");
}

/** Nota que fica no bloco depois de "Ver valor atual", para a pessoa redigitar se quiser. */
export function notaDigitadoExecucao(d: ValoresExecucao): string {
  const extras = [
    d.causa ? `causa: ${CAUSAS[d.causa]}` : null,
    d.observacao?.trim() ? `observação "${d.observacao.trim()}"` : null,
  ].filter((x): x is string => x !== null);
  if (d.qtd_realizada !== null) {
    const q = numeroBR(d.qtd_realizada);
    return extras.length ? `Você tinha digitado ${q} (${extras.join(", ")}).` : `Você tinha digitado ${q}.`;
  }
  return extras.length ? `Você tinha digitado: ${extras.join(", ")}.` : "Você tinha deixado em branco.";
}

export function notaDigitadoEfetivo(linhas: { funcao: string; quantidade: number }[]): string {
  if (linhas.length === 0) return "Você tinha deixado o efetivo vazio.";
  return `Você tinha digitado: ${linhas.map((l) => `${l.funcao} ${l.quantidade}`).join(", ")}.`;
}
