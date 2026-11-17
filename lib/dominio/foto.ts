import { falha, ok, type Resultado } from "@/lib/db/resultado";

/** Foto da parada: reduzida no aparelho (lado maior ≤ 1280 px, JPEG 0,7) antes de subir. */

export const FOTO_LADO_MAX = 1280;
export const FOTO_QUALIDADE = 0.7;
export const FOTO_MAX_BYTES = 2 * 1024 * 1024;

/** Nunca aumenta; mantém a proporção. */
export function dimensoesReduzidas(largura: number, altura: number, max = FOTO_LADO_MAX): { largura: number; altura: number } {
  const maior = Math.max(largura, altura);
  if (maior <= max) return { largura, altura };
  const k = max / maior;
  return { largura: Math.round(largura * k), altura: Math.round(altura * k) };
}

/** O aparelho sempre envia JPEG (reconvertido no canvas). */
export function validarFoto(f: { type: string; size: number } | null): Resultado {
  if (!f || f.size <= 0 || f.type !== "image/jpeg") return falha("Envie uma foto");
  if (f.size > FOTO_MAX_BYTES) return falha("Foto muito grande");
  return ok(undefined);
}

/** Começo de todo JPEG (FF D8 FF): o tipo declarado pelo navegador não basta. */
export function ehJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}
