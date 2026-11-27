import { numeroBR } from "./formato";
import { plural } from "./plural";

/** Item 4.2: HH (pessoas × horas) e material do serviço extra, separados do escopo. */

export type Material = { item: string; quantidade: number; unidade: string };
export type ApontamentoExtra = { extra_pessoas: number | null; extra_horas: number | null; materiais: Material[] };

export const MATERIAIS_MAX = 20;
const ITEM_MAX = 100;
const UNIDADE_MAX = 20;

type Erro = { erro: string; campo: string };

/** Pessoas e horas: as duas ou nenhuma. Pessoas inteiro 1–500; horas > 0 e ≤ 24. */
export function validarHHExtra(pessoas: unknown, horas: unknown): { extra_pessoas: number | null; extra_horas: number | null } | Erro {
  const vazio = (v: unknown) => v === null || v === undefined || v === "";
  if (vazio(pessoas) && vazio(horas)) return { extra_pessoas: null, extra_horas: null };
  if (vazio(pessoas) || vazio(horas)) return { erro: "Informe pessoas e horas, ou deixe os dois em branco", campo: "hh" };
  const p = Number(pessoas);
  const h = Number(horas);
  if (!Number.isInteger(p) || p < 1 || p > 500) return { erro: "Pessoas: número inteiro de 1 a 500", campo: "hh" };
  if (!Number.isFinite(h) || h <= 0 || h > 24) return { erro: "Horas: mais que 0 e até 24", campo: "hh" };
  return { extra_pessoas: p, extra_horas: Math.round(h * 100) / 100 };
}

/** Linhas totalmente vazias são ignoradas; linha incompleta recusa. */
export function validarMateriais(x: unknown): { materiais: Material[] } | Erro {
  const linhas = Array.isArray(x) ? (x as Record<string, unknown>[]) : [];
  const materiais: Material[] = [];
  for (const l of linhas) {
    const item = typeof l?.item === "string" ? l.item.trim() : "";
    const unidade = typeof l?.unidade === "string" ? l.unidade.trim() : "";
    const qRaw = l?.quantidade;
    const semQtd = qRaw === null || qRaw === undefined || qRaw === "";
    if (!item && !unidade && semQtd) continue;
    if (!item) return { erro: "Informe o item de cada linha de material", campo: "materiais" };
    if (item.length > ITEM_MAX) return { erro: `Item: máximo de ${ITEM_MAX} caracteres`, campo: "materiais" };
    const quantidade = Number(qRaw);
    if (semQtd || !Number.isFinite(quantidade) || quantidade <= 0) return { erro: `Informe a quantidade de "${item}"`, campo: "materiais" };
    if (!unidade) return { erro: `Informe a unidade de "${item}"`, campo: "materiais" };
    if (unidade.length > UNIDADE_MAX) return { erro: `Unidade: máximo de ${UNIDADE_MAX} caracteres`, campo: "materiais" };
    materiais.push({ item, quantidade, unidade });
  }
  if (materiais.length > MATERIAIS_MAX) return { erro: `Máximo de ${MATERIAIS_MAX} materiais`, campo: "materiais" };
  return { materiais };
}

export function lerMateriais(x: unknown): Material[] {
  return (Array.isArray(x) ? (x as Record<string, unknown>[]) : [])
    .map((m) => ({ item: String(m?.item ?? ""), quantidade: Number(m?.quantidade), unidade: String(m?.unidade ?? "") }))
    .filter((m) => m.item && Number.isFinite(m.quantidade));
}

export function hhDoExtra(a: { extra_pessoas?: number | null; extra_horas?: number | null }): number | null {
  return a.extra_pessoas && a.extra_horas ? Math.round(a.extra_pessoas * a.extra_horas * 100) / 100 : null;
}

/** "6 HH (3 pessoas × 2 h)" */
export function textoHHExtra(a: { extra_pessoas?: number | null; extra_horas?: number | null }): string | null {
  const hh = hhDoExtra(a);
  if (hh === null) return null;
  return `${numeroBR(hh)} HH (${a.extra_pessoas} ${plural(a.extra_pessoas!, "pessoa")} × ${numeroBR(a.extra_horas!)} h)`;
}

/** "10 m de cabo 2,5 mm; 4 un de luminária" */
export function textoMateriais(ms: Material[] | undefined): string | null {
  if (!ms || ms.length === 0) return null;
  return ms.map((m) => `${numeroBR(m.quantidade)} ${m.unidade} de ${m.item}`).join("; ");
}
