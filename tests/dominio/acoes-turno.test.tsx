import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/(app)/obras/[obraId]/turnos/[turnoId]/acoes", () => ({
  fecharTurnoAcao: vi.fn(),
  reabrirTurnoAcao: vi.fn(),
}));

import { AcoesTurno, TEXTO_REABERTURA } from "@/app/(app)/obras/[obraId]/turnos/[turnoId]/AcoesTurno";

describe("AcoesTurno", () => {
  it("texto do aviso de reabertura", () => {
    expect(TEXTO_REABERTURA).toBe("O motivo fica registrado no histórico e no próximo RDO oficial.");
  });
  it("turno fechado: botão Reabrir não envia sem antes pedir o motivo", () => {
    const html = renderToStaticMarkup(<AcoesTurno turnoId="t" fechado />);
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>Reabrir turno/);
    expect(html).not.toContain('name="motivo"');
  });
});
