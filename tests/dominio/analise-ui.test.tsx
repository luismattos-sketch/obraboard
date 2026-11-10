import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Barra } from "@/app/(app)/obras/[obraId]/analise/Barra";
import { Expansivel } from "@/app/(app)/obras/[obraId]/analise/Expansivel";

describe("Barra", () => {
  it("não corta rótulos longos de causa (quebra a linha em vez de truncar)", () => {
    const html = renderToStaticMarkup(<Barra rotulo="Liberação de área/Interferência" fracao={0.5} texto="3 (50%)" />);
    expect(html).toContain("Liberação de área/Interferência");
    expect(html).not.toContain("truncate");
    expect(html).toContain("break-words");
  });

  it("usa apenas elementos de frase (válido dentro de <summary>)", () => {
    const html = renderToStaticMarkup(<Barra rotulo="Material" fracao={1} texto="1 (100%)" />);
    expect(html).not.toMatch(/<div/);
  });
});

describe("Expansivel", () => {
  it("mostra uma seta que gira ao abrir e esconde o marcador nativo", () => {
    const html = renderToStaticMarkup(<Expansivel resumo={<span>Semana</span>}><p>Detalhe</p></Expansivel>);
    expect(html).toMatch(/<details[^>]*class="[^"]*group/);
    expect(html).toContain("group-open:rotate-90");
    expect(html).toContain("[&amp;::-webkit-details-marker]:hidden");
    expect(html).toContain("Detalhe");
  });
});
