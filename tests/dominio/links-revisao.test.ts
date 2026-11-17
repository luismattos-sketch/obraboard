import { describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/lib/supabase/servidor", () => ({ criarClienteServidor: async () => ({}) }));
vi.mock("@/lib/db/quadro", () => ({ gerarLinkQuadro: async () => ({ ok: true, dados: { codigo: "novo" } }) }));

import { gerarLinkQuadroAcao } from "@/app/(app)/obras/[obraId]/acoesQuadro";
import { linkExibido } from "@/lib/dominio/link";

describe("revisão: links", () => {
  it("gerar link do quadro revalida a página da obra (Voltar não mostra código morto)", async () => {
    await gerarLinkQuadroAcao("obra-1");
    expect(revalidatePath).toHaveBeenCalledWith("/obras/obra-1");
  });
  it("o link guardado no servidor vence o gerado nesta aba (outra aba pode ter trocado)", () => {
    expect(linkExibido("gerado", "servidor")).toBe("servidor");
    expect(linkExibido("gerado", null)).toBe("gerado");
    expect(linkExibido(null, null)).toBeNull();
  });
});
