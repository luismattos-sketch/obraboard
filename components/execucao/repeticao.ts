/** Política de repetição do auto-salvamento após falha de rede (função pura, testável). */

/** Intervalos crescentes; depois do último, repete sempre com ele. Nunca desiste. */
export const INTERVALOS_REPETIR_MS = [5000, 10000, 20000, 30000] as const;
/** Sem conexão: espera o evento `online` (antecipa) e, por garantia, tenta a cada 30 s. */
const ESPERA_OFFLINE_MS = 30000;

export const MSG_SEM_SINAL = "Não salvo — sem sinal. Tentando de novo…";

export type DecisaoRepeticao = { falhas: number; emMs: number };

/** `falhas` = falhas seguidas antes desta. Online conta a falha e alonga o intervalo; offline só espera. */
export function decidirRepeticao(falhas: number, online: boolean): DecisaoRepeticao {
  if (!online) return { falhas, emMs: ESPERA_OFFLINE_MS };
  const i = Math.min(falhas, INTERVALOS_REPETIR_MS.length - 1);
  return { falhas: falhas + 1, emMs: INTERVALOS_REPETIR_MS[i] };
}

/** Aviso fixo no topo enquanto houver lançamento que falhou ao salvar. */
export function textoPendentes(n: number): string {
  const qual = n === 1 ? "1 lançamento não salvo" : `${n} lançamentos não salvos`;
  return `⚠ ${qual}. Não feche nem atualize esta tela.`;
}
