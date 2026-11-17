import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/(app)/obras/[obraId]/turnos/[turnoId]/acoes", () => ({
  gerarNovoLinkAcao: vi.fn(),
  liberarTurnoAcao: vi.fn(),
}));
vi.mock("@/app/(app)/obras/[obraId]/acoesQuadro", () => ({ gerarLinkQuadroAcao: vi.fn() }));

import { CONFIRMAR_NOVO_LINK_CAMPO, PainelLink } from "@/app/(app)/obras/[obraId]/turnos/[turnoId]/PainelLink";
import { CONFIRMAR_NOVO_LINK, LinkQuadro } from "@/app/(app)/obras/[obraId]/LinkQuadro";
import { TEXTO_LINK_ANTIGO, urlCampo, urlQuadro } from "@/lib/dominio/link";

const TOKEN = "a".repeat(43);
const base = { turnoId: "t", obraNome: "Obra", data: "2026-11-16", periodo: "diurno" };

describe("PainelLink", () => {
  it("em campo mostra o link guardado, copiar e WhatsApp", () => {
    const html = renderToStaticMarkup(<PainelLink {...base} status="em_campo" tokenAtual={TOKEN} linkAntigo={false} />);
    expect(html).toContain(urlCampo(TOKEN));
    expect(html).toContain("Copiar link");
    expect(html).toContain("Enviar pelo WhatsApp");
    expect(html).not.toContain("não será exibido de novo");
  });
  it("link antigo (sem token guardado) explica e oferece gerar novo", () => {
    const html = renderToStaticMarkup(<PainelLink {...base} status="enviado" tokenAtual={null} linkAntigo />);
    expect(html).toContain(TEXTO_LINK_ANTIGO);
    expect(html).toContain("Gerar novo link");
  });
  it("turno fechado não mostra o painel", () => {
    expect(renderToStaticMarkup(<PainelLink {...base} status="fechado" tokenAtual={TOKEN} linkAntigo={false} />)).toBe("");
  });
  it("texto da confirmação", () => {
    expect(CONFIRMAR_NOVO_LINK_CAMPO).toBe("O link já enviado para as equipes vai parar de funcionar");
  });
});

describe("LinkQuadro", () => {
  it("mostra o link guardado com copiar e abrir", () => {
    const html = renderToStaticMarkup(<LinkQuadro obraId="o" existe codigoAtual={TOKEN} />);
    expect(html).toContain(urlQuadro(TOKEN));
    expect(html).toContain("Copiar");
    expect(html).toContain("Abrir");
    expect(html).not.toContain("não será exibido de novo");
  });
  it("link antigo explica", () => {
    expect(renderToStaticMarkup(<LinkQuadro obraId="o" existe codigoAtual={null} />)).toContain(TEXTO_LINK_ANTIGO);
  });
  it("sem link: botão Gerar link", () => {
    expect(renderToStaticMarkup(<LinkQuadro obraId="o" existe={false} codigoAtual={null} />)).toContain("Gerar link</button>");
  });
  it("texto da confirmação", () => {
    expect(CONFIRMAR_NOVO_LINK).toBe("O link que está na TV e com o gestor vai parar de funcionar");
  });
});
