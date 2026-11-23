import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RelatosCampo } from "@/app/(app)/obras/[obraId]/turnos/[turnoId]/RelatosCampo";
import type { Relato } from "@/lib/db/relatos";

const rel = (p: Partial<Relato>): Relato => ({
  id: "r", responsavel_id: "ana", texto: "fizemos 30 m", tentativas: 1, lancado: true,
  criado_em: "2026-11-22T13:05:00Z", atualizado_em: "2026-11-22T13:05:00Z", ...p,
});

describe("RelatosCampo", () => {
  it("sem relatos não mostra nada", () => {
    expect(renderToStaticMarkup(<RelatosCampo relatos={[]} responsaveis={[]} />)).toBe("");
  });

  it("lista fechada com nome, hora de São Paulo, texto e situação", () => {
    const html = renderToStaticMarkup(
      <RelatosCampo
        relatos={[rel({}), rel({ id: "r2", responsavel_id: "x", texto: "faltou andaime", lancado: false, atualizado_em: "2026-11-22T18:40:00Z" })]}
        responsaveis={[{ id: "ana", nome: "Ana", ativo: true }]}
      />,
    );
    expect(html).toContain("<details");
    expect(html).not.toContain("<details open");
    expect(html).toContain("O que o campo escreveu (2)");
    expect(html).toContain("Ana · 10:05");
    expect(html).toContain("Responsável removido · 15:40");
    expect(html).toContain("fizemos 30 m");
    expect(html).toContain(">lançado<");
    expect(html).toContain(">não lançado<");
  });
});
