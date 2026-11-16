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

describe("IndicadorSalvo sem sinal", () => {
  it("falha de rede: avisa e oferece 'Tentar de novo'", () => {
    const html = renderToStaticMarkup(<IndicadorSalvo estado="erro" tentar={() => {}} />);
    expect(html).toContain("Não salvo — sem sinal. Tentando de novo…");
    expect(html).toContain("Tentar de novo</button>");
  });
  it("erro de negócio não oferece 'Tentar de novo'", () => {
    const html = renderToStaticMarkup(<IndicadorSalvo estado="erro" mensagem="Digite um número válido" tentar={() => {}} />);
    expect(html).toContain("Digite um número válido");
    expect(html).not.toContain("Tentar de novo</button>");
  });
});

describe("AvisoPendentes e selo", () => {
  it("sem falhas não mostra nada; com falhas avisa no plural e oferece tentar", async () => {
    const { AvisoPendentes } = await import("@/components/execucao/AvisoPendentes");
    expect(renderToStaticMarkup(<AvisoPendentes falhas={0} tentar={() => {}} />)).toBe("");
    const html = renderToStaticMarkup(<AvisoPendentes falhas={2} tentar={() => {}} />);
    expect(html).toContain("2 lançamentos não salvos");
    expect(html).toContain("Tentar de novo</button>");
  });
  it("selo expõe o tom", async () => {
    const { Selo } = await import("@/components/ui/Selo");
    expect(renderToStaticMarkup(<Selo tom="neutro">Concluída</Selo>)).toContain('data-tom="neutro"');
  });
});
