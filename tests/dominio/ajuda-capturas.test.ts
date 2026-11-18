import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CAPITULOS, caminhoCaptura } from "@/lib/ajuda/capitulos";

describe("capturas do manual", () => {
  it("todo passo com captura tem a imagem em public/ajuda (rode npm run manual:capturas)", () => {
    const faltando = CAPITULOS.flatMap((c) =>
      c.passos.filter((p) => p.captura).map((p) => `public${caminhoCaptura(c.slug, p.id)}`),
    ).filter((arq) => !existsSync(arq));
    expect(faltando).toEqual([]);
  });
});
