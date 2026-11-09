import type { Periodo } from "@/lib/dominio/tipos";

/** "Edifício Aurora" -> "edificio-aurora" (vazio -> "obra"). */
function slug(texto: string): string {
  const s = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "obra";
}

export function nomeArquivoRdo(obra: string, data: string, periodo: Periodo): string {
  return `RDO-${slug(obra)}-${data}-${periodo}.pdf`;
}
