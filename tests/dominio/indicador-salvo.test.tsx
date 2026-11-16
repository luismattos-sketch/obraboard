import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { IndicadorSalvo } from "@/components/execucao/IndicadorSalvo";

describe("IndicadorSalvo", () => {
  it("conflito: mostra a explicação e o botão 'Ver valor atual'", () => {
    const html = renderToStaticMarkup(
      <IndicadorSalvo estado="erro" mensagem="Mudou em outra tela (pode ter sido você em outra aba)." conflito={{}} onVerAtual={() => {}} />,
    );
    expect(html).toContain("Mudou em outra tela");
    expect(html).toContain("Ver valor atual");
    expect(html).toContain('type="button"');
  });

  it("erro comum não oferece 'Ver valor atual'", () => {
    const html = renderToStaticMarkup(<IndicadorSalvo estado="erro" mensagem="Turno fechado" onVerAtual={() => {}} />);
    expect(html).toContain("Turno fechado");
    expect(html).not.toContain("Ver valor atual");
  });

  it("depois de carregar: mostra a nota do que foi digitado", () => {
    const html = renderToStaticMarkup(<IndicadorSalvo estado="ocioso" nota="Você tinha digitado 47." />);
    expect(html).toContain("Você tinha digitado 47.");
  });
});
