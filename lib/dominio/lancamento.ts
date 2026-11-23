import { parseNumero } from "./entrada";
import { numeroBR } from "./formato";

/** O campo é o total do dia; "+ Somar" acrescenta um trecho a ele. */
export function somarLancamento(
  totalTexto: string,
  maisTexto: string,
): { ok: true; total: number } | { ok: false; erro: string } {
  const total = totalTexto.trim() === "" ? 0 : parseNumero(totalTexto);
  if (total === null) return { ok: false, erro: "Corrija o total antes de somar" };
  const mais = parseNumero(maisTexto);
  if (mais === null || mais <= 0) return { ok: false, erro: "Digite um número válido" };
  return { ok: true, total: Math.round((total + mais) * 1000) / 1000 };
}

/** Prévia: "40 + 30 = 70". */
export function textoSoma(total: number, mais: number): string {
  return `${numeroBR(total)} + ${numeroBR(mais)} = ${numeroBR(Math.round((total + mais) * 1000) / 1000)}`;
}

/** "✓ Concluída" com parcial pergunta antes de trocar pela meta; vazio/0 ou já na meta não pergunta. */
export function perguntaConcluida(qtd: number | null, meta: number): string | null {
  if (qtd === null || qtd <= 0 || qtd >= meta) return null;
  return `Trocar ${numeroBR(qtd)} por ${numeroBR(meta)}?`;
}

/** Número para o campo de digitação: vírgula decimal, sem ponto de milhar. */
export function textoTotal(n: number): string {
  return String(n).replace(".", ",");
}

/** Somas seguidas antes de gravar viram um envio só: o aviso de conflito fala do total somado. */
export function acumularSomado(anterior: number | undefined, mais: number): number {
  return Math.round(((anterior ?? 0) + mais) * 1000) / 1000;
}
