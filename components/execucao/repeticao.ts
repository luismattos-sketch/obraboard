/** Política de repetição do auto-salvamento após falha de rede (função pura, testável). */

export const INTERVALO_REPETIR_MS = 5000;
export const MAX_REPETICOES = 5;
export const ERRO_DESISTIU = "Não foi possível salvar. Recarregue a página.";

export type DecisaoRepeticao = { repetir: true; falhas: number; emMs: number } | { repetir: false; mensagem: string };

/**
 * `falhas` = falhas seguidas antes desta. Sem conexão (navigator.onLine === false) repete sempre
 * e zera a contagem; online, repete até MAX_REPETICOES vezes e depois desiste.
 */
export function decidirRepeticao(falhas: number, online: boolean): DecisaoRepeticao {
  if (!online) return { repetir: true, falhas: 0, emMs: INTERVALO_REPETIR_MS };
  const n = falhas + 1;
  if (n > MAX_REPETICOES) return { repetir: false, mensagem: ERRO_DESISTIU };
  return { repetir: true, falhas: n, emMs: INTERVALO_REPETIR_MS };
}
