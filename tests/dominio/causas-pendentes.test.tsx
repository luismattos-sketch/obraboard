import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BotaoTerminei } from "@/components/execucao/BotaoTerminei";
import { CausasPendentes, linhaPendente } from "@/components/execucao/CausasPendentes";

const p = (descricao: string, qtd_planejada: number, qtd_realizada: number | null, unidade: string, id = descricao) => ({
  id, descricao, qtd_planejada, qtd_realizada, unidade, causa: null, observacao: null,
});

describe("linhaPendente", () => {
  it("mostra feito de previsto", () => {
    expect(linhaPendente(p("Montagem", 8, 3, "tubo"))).toBe("Montagem (3 de 8 tubo)");
  });
  it("sem lançamento vale 0", () => {
    expect(linhaPendente(p("Solda", 4, null, "un"))).toBe("Solda (0 de 4 un)");
  });
  it("decimal com vírgula", () => {
    expect(linhaPendente(p("Concreto", 5, 2.5, "m³"))).toBe("Concreto (2,5 de 5 m³)");
  });
});

describe("CausasPendentes", () => {
  it("título, linhas e botão ir", () => {
    const html = renderToStaticMarkup(
      <CausasPendentes titulo="Antes de terminar, informe a causa em:" pendentes={[p("Montagem", 8, 3, "tubo"), p("Solda", 4, null, "un")]} />,
    );
    expect(html).toContain("Antes de terminar, informe a causa em:");
    expect(html).toContain("Montagem (3 de 8 tubo)");
    expect(html).toContain("Solda (0 de 4 un)");
    expect(html).toContain('aria-label="Ir para a causa: Montagem"');
    expect(html).not.toContain("perigo");
  });
  it("lista vazia não mostra nada", () => {
    expect(renderToStaticMarkup(<CausasPendentes titulo="x" pendentes={[]} />)).toBe("");
  });
});

describe("BotaoTerminei salvando", () => {
  it("enquanto salva, o botão fica desabilitado", () => {
    const html = renderToStaticMarkup(
      <BotaoTerminei terminouEm={null} abertasDaEquipe={0} marcar={() => {}} desfazer={() => {}} linkWhats={() => ""} salvando />,
    );
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Salvando…<\/button>/);
  });
});
