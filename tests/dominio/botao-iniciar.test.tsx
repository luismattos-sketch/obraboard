import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BotaoIniciar } from "@/components/execucao/BotaoIniciar";

const props = { iniciouEm: null, marcar: () => {}, desfazer: () => {} };

describe("BotaoIniciar", () => {
  it("antes: botão Iniciar turno com a explicação", () => {
    const html = renderToStaticMarkup(<BotaoIniciar {...props} />);
    expect(html).toContain("Iniciar turno");
    expect(html).toContain("Toque quando sua equipe começar. A hora fica registrada para o planejador.");
    expect(html).not.toContain("Desfazer");
  });

  it("depois: hora do início e Desfazer", () => {
    const html = renderToStaticMarkup(<BotaoIniciar {...props} iniciouEm="07:12:00" />);
    expect(html).toContain("✓ Você iniciou às 07:12");
    expect(html).toContain("Desfazer");
    expect(html).not.toContain("Toque quando");
  });

  it("salvando: mostra Salvando…", () => {
    expect(renderToStaticMarkup(<BotaoIniciar {...props} salvando />)).toContain("Salvando…");
  });
});
