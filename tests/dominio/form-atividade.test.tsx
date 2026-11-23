import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/(app)/obras/[obraId]/turnos/[turnoId]/acoes", () => ({ adicionarAtividadeAcao: vi.fn() }));
vi.mock("@/components/responsaveis/MenuResponsavel", () => ({ MenuResponsavel: () => <span>Responsável</span> }));
const { FormAtividade } = await import("@/app/(app)/obras/[obraId]/turnos/[turnoId]/FormAtividade");

describe("FormAtividade", () => {
  it("inclusão no turno pede Responsável e Equipe prevista", () => {
    const html = renderToStaticMarkup(<FormAtividade turnoId="t" obraId="o" responsaveis={[]} sugestoesFuncao={["Soldador"]} />);
    expect(html).toContain("Responsável");
    expect(html).toContain("Equipe prevista");
    expect(html).toContain('name="responsavel_id"');
  });
  it("edição não mostra os campos novos", () => {
    const html = renderToStaticMarkup(<FormAtividade turnoId="t" />);
    expect(html).not.toContain("Equipe prevista");
  });
});
