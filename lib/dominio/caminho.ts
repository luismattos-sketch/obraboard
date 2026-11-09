/** Aceita apenas caminhos relativos do próprio site (evita open redirect). */
export function caminhoSeguro(proximo: string | null | undefined, padrao = "/obras"): string {
  if (!proximo) return padrao;
  if (!proximo.startsWith("/")) return padrao;
  if (proximo.startsWith("//") || proximo.startsWith("/\\")) return padrao;
  return proximo;
}
