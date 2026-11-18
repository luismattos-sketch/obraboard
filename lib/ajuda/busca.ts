// Busca simples no manual: sem acento, sem maiúsculas, todas as palavras precisam aparecer.
import { CAPITULOS, hrefPasso } from "./capitulos";
import type { Capitulo, SlugCapitulo } from "./tipos";

export type ResultadoBusca = { slug: SlugCapitulo; capitulo: string; passoId: string; passo: string; href: string };

export function normalizarBusca(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Passos que contêm todas as palavras; os que casam no título vêm primeiro, depois a ordem do manual. */
export function buscarAjuda(termo: string, capitulos: Capitulo[] = CAPITULOS): ResultadoBusca[] {
  const normal = normalizarBusca(termo);
  if (normal.length < 2) return [];
  const palavras = normal.split(" ");
  const contemTodas = (texto: string) => palavras.every((p) => texto.includes(p));

  const noTitulo: ResultadoBusca[] = [];
  const noTexto: ResultadoBusca[] = [];
  for (const c of capitulos) {
    for (const p of c.passos) {
      const titulo = normalizarBusca(p.titulo);
      const tudo = normalizarBusca([p.titulo, ...p.texto, p.dica ?? ""].join(" "));
      if (!contemTodas(tudo)) continue;
      const r = { slug: c.slug, capitulo: c.titulo, passoId: p.id, passo: p.titulo, href: hrefPasso(c.slug, p.id) };
      (contemTodas(titulo) ? noTitulo : noTexto).push(r);
    }
  }
  return [...noTitulo, ...noTexto];
}
