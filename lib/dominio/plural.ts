import { numeroBR } from "./formato";

// Abreviações/símbolos de unidade nunca vão para o plural (m, m², kg, un, ml, vb…).
const ABREV = /^(?:[a-zà-ú]{1,2}\d?|[a-zà-ú]*[²³\d./%].*|un|und|pç|pc|vb|cj|kg|ton|ml|hh|lt)$/i;

/** Plural simples em português para funções e unidades por extenso ("tubo" → "tubos", "Soldador" → "Soldadores"). */
export function plural(n: number, palavra: string): string {
  const p = palavra.trim();
  if (!p || (n !== 0 && Math.abs(n) < 2) || ABREV.test(p) || /\s/.test(p)) return palavra;
  if (/ão$/i.test(p)) return p.replace(/ão$/i, "ões");
  if (/al$/i.test(p)) return p.replace(/al$/i, "ais");
  if (/[rz]$/i.test(p)) return `${p}es`;
  if (/m$/i.test(p)) return p.replace(/m$/i, "ns");
  if (/[aeiouáéíóúâêô]$/i.test(p)) return `${p}s`;
  return palavra;
}

/** "8 tubos", "12,5 m", "1 Soldador". */
export function qtdComUnidade(n: number, unidade: string | null | undefined): string {
  return unidade ? `${numeroBR(n)} ${plural(n, unidade)}` : numeroBR(n);
}

/** "2 Soldadores" (contagem inteira de pessoas). */
export function pessoas(n: number, funcao: string): string {
  return `${n} ${plural(n, funcao)}`;
}
