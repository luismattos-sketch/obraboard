import { expect, type Page } from "@playwright/test";
import { CAPITULOS, caminhoCaptura } from "@/lib/ajuda/capitulos";
import type { SlugCapitulo } from "@/lib/ajuda/tipos";

const fotografados = new Set<string>();

/**
 * Destaca o alvo do passo (registrado em lib/ajuda/) e salva a captura em public/ajuda/.
 * Falha se o alvo não estiver na tela: o manual ficou desatualizado.
 * Com MANUAL_CAPITULO definido, só grava as imagens daquele capítulo (os outros só são validados).
 */
export async function fotografar(page: Page, slug: SlugCapitulo, passoId: string): Promise<void> {
  const passo = CAPITULOS.find((c) => c.slug === slug)?.passos.find((p) => p.id === passoId);
  if (!passo?.captura) throw new Error(`Passo sem captura no manual: ${slug}#${passoId}`);
  const { alvo } = passo.captura;
  const elemento = page.getByRole(alvo.papel, { name: alvo.nome }).first();
  await expect(elemento, `Manual desatualizado: ${slug}#${passoId} não achou ${alvo.papel} "${alvo.nome}"`).toBeVisible();
  await elemento.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  const gravar = !process.env.MANUAL_CAPITULO || process.env.MANUAL_CAPITULO === slug;
  if (gravar) {
    // Esconde o selo de desenvolvimento do Next (não existe em produção).
    await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => e.remove()));
    await elemento.evaluate((el) => {
      (el as HTMLElement).dataset.destaqueManual = (el as HTMLElement).style.outline;
      (el as HTMLElement).style.outline = "3px solid #ff6b00";
      (el as HTMLElement).style.outlineOffset = "3px";
    });
    await page.screenshot({ path: `public${caminhoCaptura(slug, passoId)}`, scale: "css" });
    await elemento.evaluate((el) => {
      (el as HTMLElement).style.outline = (el as HTMLElement).dataset.destaqueManual ?? "";
      (el as HTMLElement).style.outlineOffset = "";
    });
  }
  fotografados.add(`${slug}#${passoId}`);
}

/** Passos com captura no manual que o roteiro não fotografou. */
export function naoFotografados(): string[] {
  return CAPITULOS.flatMap((c) => c.passos.filter((p) => p.captura).map((p) => `${c.slug}#${p.id}`)).filter(
    (k) => !fotografados.has(k),
  );
}
