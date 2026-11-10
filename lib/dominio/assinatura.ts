import { statusAtividade } from "./calculos";
import type { Causa, CondicaoClima } from "./tipos";

/**
 * "Assinaturas" do que cada bloco grava, no formato do banco. O mesmo valor sai do estado local
 * (deps do auto-salvamento) e dos dados do servidor: se forem iguais, a tela já mostra o que
 * está gravado; se o servidor mudar por fora, o bloco é remontado com os dados novos.
 */

/** Execução de uma atividade. `qtd` string = texto inválido ainda não salvo. */
export function tuplaExecucao(
  qtd_planejada: number,
  qtd: number | string | null,
  causa: Causa | "" | null,
  observacao: string | null,
): [number | string | null, Causa | null, string | null] {
  const concluida = typeof qtd === "number" && statusAtividade(qtd_planejada, qtd) === "concluida";
  const obs = observacao?.trim() ? observacao.trim() : null;
  return [qtd, concluida || !causa ? null : causa, concluida ? null : obs];
}

/** Efetivo, independente da ordem das linhas. */
export function tuplaEfetivo(linhas: { funcao: string; quantidade: number }[]): [string, number][] {
  return linhas
    .map((l): [string, number] => [l.funcao.trim(), l.quantidade])
    .sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] < b[0] ? -1 : 1));
}

/** Horário real ("HH:MM" ou vazio). */
export const tuplaHorario = (inicio: string | null, fim: string | null): [string | null, string | null] => [
  inicio || null,
  fim || null,
];

/** Clima de um período (sem condição = sem registro). */
export const tuplaClima = (condicao: CondicaoClima | "" | null, impediu: boolean): [CondicaoClima | null, boolean] => [
  condicao || null,
  condicao ? impediu === true : false,
];
