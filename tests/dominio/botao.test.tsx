import { describe, expect, it } from "vitest";
import { classesBotao } from "@/components/ui/Botao";

describe("classesBotao", () => {
  it("variante discreta: só texto, sem fundo vermelho", () => {
    const c = classesBotao("discreto");
    expect(c).toContain("bg-transparent");
    expect(c).toContain("underline");
    expect(c).not.toContain("bg-perigo");
  });
});
