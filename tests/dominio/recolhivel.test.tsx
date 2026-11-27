import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Recolhivel } from "@/components/ui/Recolhivel";

describe("Recolhivel", () => {
  it("começa fechado por padrão", () => {
    const html = renderToStaticMarkup(<Recolhivel titulo="RDO">conteúdo</Recolhivel>);
    expect(html).toMatch(/<details(?![^>]*\bopen\b)[^>]*>/);
    expect(html).toMatch(/<summary[^>]*>RDO<\/summary>/);
    expect(html).toContain("conteúdo");
  });
  it("abertoInicial abre", () => {
    const html = renderToStaticMarkup(<Recolhivel titulo="RDO" abertoInicial>x</Recolhivel>);
    expect(html).toMatch(/<details[^>]*open=""/);
  });
  it("controlado segue a prop aberto", () => {
    const html = renderToStaticMarkup(<Recolhivel titulo="Corrigir execução" aberto aoMudar={() => {}}>x</Recolhivel>);
    expect(html).toMatch(/<details[^>]*open=""/);
  });
});
