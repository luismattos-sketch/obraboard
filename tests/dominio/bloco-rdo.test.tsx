import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BlocoRdo } from "@/app/(app)/obras/[obraId]/turnos/[turnoId]/BlocoRdo";

const v1 = { id: "id-v1", numero: 1, emitido_em: "2026-11-09T21:40:00Z" };
const v2 = { id: "id-v2", numero: 2, emitido_em: "2026-11-10T11:15:00Z" };

describe("BlocoRdo", () => {
  it("fechado: baixa a versão atual e lista as anteriores", () => {
    const html = renderToStaticMarkup(<BlocoRdo turnoId="t1" fechado versoes={[v1, v2]} />);
    expect(html).toMatch(/href="\/api\/rdo\/versao\/id-v2"[^>]*>Baixar RDO \(v2\)</);
    expect(html).toContain("Versões anteriores:");
    expect(html).toMatch(/href="\/api\/rdo\/versao\/id-v1"[^>]*>v1 \(09\/11 às 18:40\)</);
    expect(html).not.toContain("rascunho");
  });

  it("fechado só com v1: sem versões anteriores", () => {
    const html = renderToStaticMarkup(<BlocoRdo turnoId="t1" fechado versoes={[v1]} />);
    expect(html).toContain("Baixar RDO (v1)");
    expect(html).not.toContain("Versões anteriores");
  });

  it("aberto sem versões: só a prévia", () => {
    const html = renderToStaticMarkup(<BlocoRdo turnoId="t1" fechado={false} versoes={[]} />);
    expect(html).toMatch(/href="\/api\/rdo\/t1"[^>]*>Baixar prévia \(rascunho\)</);
    expect(html).not.toContain("oficial");
  });

  it("reaberto: prévia e a última versão oficial", () => {
    const html = renderToStaticMarkup(<BlocoRdo turnoId="t1" fechado={false} versoes={[v1, v2]} />);
    expect(html).toContain("Baixar prévia (rascunho)");
    expect(html).toMatch(/href="\/api\/rdo\/versao\/id-v2"[^>]*>Baixar v2 oficial</);
  });
});
