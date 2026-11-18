import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { BotaoAjuda } from "@/components/ajuda/BotaoAjuda";
import { ComoUsarCampo } from "@/components/ajuda/ComoUsarCampo";
import { Fluxograma } from "@/components/ajuda/Fluxograma";
import { capituloPorSlug } from "@/lib/ajuda/capitulos";
import { Novidades } from "@/components/ajuda/Novidades";
import { PassoAjuda } from "@/components/ajuda/PassoAjuda";
import { FLUXOGRAMA } from "@/lib/ajuda/fluxograma";
import { caminhoCaptura } from "@/lib/ajuda/capitulos";
import type { Novidade, Passo } from "@/lib/ajuda/tipos";

const contemCaminho = (html: string, p: string) => html.includes(p) || html.includes(encodeURIComponent(p));

describe("Fluxograma", () => {
  const html = renderToStaticMarkup(<Fluxograma fases={FLUXOGRAMA} />);
  it("mostra as 4 fases e a nota do turno", () => {
    for (const f of FLUXOGRAMA) expect(html).toContain(f.titulo);
    expect(html).toContain("Dá para criar o turno sem programar a semana");
  });
  it("cada caixa é um link para o passo que a explica", () => {
    for (const f of FLUXOGRAMA) for (const l of f.linhas) for (const cx of l) {
      expect(html).toContain(`href="${cx.href}"`);
    }
  });
  it("as caixas são links acessíveis pelo teclado e pelo leitor de tela (sem lista escondida)", () => {
    expect(html).not.toContain('tabindex="-1"');
    expect(html).not.toContain("sr-only");
    expect(html).not.toMatch(/<div aria-hidden="true"[^>]*>\s*<section/);
  });
});

describe("PassoAjuda", () => {
  const passo: Passo = {
    id: "liberar",
    titulo: "Libere o turno",
    texto: ["Primeiro parágrafo.", "Segundo parágrafo."],
    dica: "Uma dica.",
    captura: { alt: "Tela do turno", alvo: { papel: "button", nome: "Liberar para campo" }, dispositivo: "computador" },
  };
  const html = renderToStaticMarkup(<PassoAjuda slug="check-in" passo={passo} numero={3} />);
  it("tem âncora, número, título, parágrafos e dica", () => {
    expect(html).toContain('id="liberar"');
    expect(html).toContain("3");
    expect(html).toContain("Libere o turno");
    expect(html).toContain("<p");
    expect(html).toContain("Segundo parágrafo.");
    expect(html).toContain("Uma dica.");
  });
  it("mostra a captura com texto alternativo", () => {
    expect(html).toContain('alt="Tela do turno"');
    expect(contemCaminho(html, caminhoCaptura("check-in", "liberar"))).toBe(true);
  });
  it("passo sem captura não tem imagem", () => {
    const sem = renderToStaticMarkup(<PassoAjuda slug="check-in" passo={{ ...passo, captura: undefined }} numero={1} />);
    expect(sem).not.toContain("<img");
  });
});

describe("Novidades", () => {
  const lista: Novidade[] = [1, 2, 3, 4, 5].map((i) => ({ data: `2026-11-1${i}`, texto: `Novidade ${i}`, href: "/ajuda" }));
  const html = renderToStaticMarkup(<Novidades novidades={lista} />);
  it("mostra as 3 primeiras fora e o resto em Ver todas", () => {
    const [antes, depois] = html.split("<details");
    expect(antes).toContain("Novidade 1");
    expect(antes).toContain("Novidade 3");
    expect(antes).not.toContain("Novidade 4");
    expect(depois).toContain("Ver todas");
    expect(depois).toContain("Novidade 5");
  });
  it("com até 3 novidades não mostra Ver todas", () => {
    expect(renderToStaticMarkup(<Novidades novidades={lista.slice(0, 3)} />)).not.toContain("Ver todas");
  });
});

describe("BotaoAjuda", () => {
  it("leva ao capítulo da tela com rótulo acessível", () => {
    const html = renderToStaticMarkup(<BotaoAjuda tela="turno-em-campo" />);
    expect(html).toContain('href="/ajuda/durante-o-turno"');
    expect(html).toContain('aria-label="Ajuda sobre esta tela"');
  });
});

describe("ComoUsarCampo", () => {
  const html = renderToStaticMarkup(<ComoUsarCampo />);
  it("é um painel recolhível 'Como usar' com todos os passos do campo", () => {
    expect(html).toMatch(/<details[^>]*>\s*<summary[^>]*>[^<]*Como usar/);
    for (const p of capituloPorSlug("campo")!.passos) expect(html).toContain(p.titulo);
  });
  it("não guarda nada no navegador", () => {
    const fonte = readFileSync("components/ajuda/ComoUsarCampo.tsx", "utf8");
    expect(fonte).not.toMatch(/localStorage|sessionStorage/);
  });
});
