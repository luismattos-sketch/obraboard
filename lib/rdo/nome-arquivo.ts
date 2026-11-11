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

/** Sufixo do arquivo: versão oficial (`-v2`) ou prévia (`-rascunho`). */
export type SufixoRdo = { versao: number } | "rascunho";

export function nomeArquivoRdo(obra: string, data: string, periodo: Periodo, sufixo?: SufixoRdo): string {
  const fim = sufixo === undefined ? "" : sufixo === "rascunho" ? "-rascunho" : `-v${sufixo.versao}`;
  return `RDO-${slug(obra)}-${data}-${periodo}${fim}.pdf`;
}

/** PDF único do mês: `RDOs-<obra>-AAAA-MM.pdf` ou `RDOs-todas-as-obras-AAAA-MM.pdf`. */
export function nomeArquivoLote(obraNome: string | null, mes: string): string {
  return `RDOs-${obraNome === null ? "todas-as-obras" : slug(obraNome)}-${mes}.pdf`;
}
