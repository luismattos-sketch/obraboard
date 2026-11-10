/** Aceita apenas caminhos relativos do próprio site (evita open redirect). */
export function caminhoSeguro(proximo: string | null | undefined, padrao = "/obras"): string {
  if (!proximo) return padrao;
  if (!proximo.startsWith("/")) return padrao;
  if (proximo.startsWith("//") || proximo.startsWith("/\\")) return padrao;
  // Navegadores e o parser de URL removem tab/quebras de linha, o que reabriria "//".
  if (/[\x00-\x1f\x7f\s]/.test(proximo)) return padrao;
  try {
    const url = new URL(proximo, "http://x");
    if (url.origin !== "http://x") return padrao;
    const r = url.pathname + url.search + url.hash;
    return r.startsWith("//") ? padrao : r; // ex.: "/.//evil.com"
  } catch {
    return padrao;
  }
}
