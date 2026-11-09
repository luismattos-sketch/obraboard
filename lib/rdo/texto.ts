/**
 * As fontes padrão do PDF (Helvetica) só têm os caracteres do WinAnsi (Windows-1252).
 * Fora disso (emoji, símbolos) o react-pdf gera lixo ou falha; trocamos por equivalentes ou removemos.
 */

// Caracteres de 0x80–0x9F do Windows-1252 (o resto do intervalo 0xA0–0xFF é igual ao Latin-1).
const EXTRAS_1252 = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

const TROCAS: Record<string, string> = {
  "‐": "-", // hífen
  "‑": "-", // hífen não separável
  "‒": "-", // figure dash
  "−": "-", // sinal de menos
  "′": "'",
  "″": '"',
  "→": "->",
  "←": "<-",
  "≤": "<=",
  "≥": ">=",
  "✓": "v",
  "✔": "v",
};

function permitido(ch: string): boolean {
  const c = ch.codePointAt(0)!;
  if (c === 0x09 || c === 0x0a || c === 0x0d) return true;
  if (c >= 0x20 && c <= 0x7e) return true;
  if (c >= 0xa0 && c <= 0xff) return true;
  return EXTRAS_1252.has(ch);
}

/** Texto seguro para as fontes padrão do PDF (WinAnsi). */
export function textoWinAnsi(s: string): string {
  let r = "";
  for (const ch of s.normalize("NFC")) {
    if (permitido(ch)) r += ch;
    else if (TROCAS[ch] !== undefined) r += TROCAS[ch];
    // demais (emoji, seletores de variação, ZWJ, CJK…) são removidos
  }
  return r;
}

/** Aplica textoWinAnsi em todas as strings de um objeto de dados (cópia). */
export function sanitizarProfundo<T>(v: T): T {
  if (typeof v === "string") return textoWinAnsi(v) as T;
  if (Array.isArray(v)) return v.map((x) => sanitizarProfundo(x)) as T;
  if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
    const r: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) r[k] = sanitizarProfundo(x);
    return r as T;
  }
  return v;
}
