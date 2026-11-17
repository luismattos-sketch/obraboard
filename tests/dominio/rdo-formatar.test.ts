import { describe, expect, it } from "vitest";
import { descricaoComTipo } from "@/lib/rdo/formatar";

describe("descricaoComTipo", () => {
  it("RDO marca extra", () => {
    expect(descricaoComTipo({ descricao: "Troca de iluminação", tipo: "extra" })).toBe("Extra · Troca de iluminação");
    expect(descricaoComTipo({ descricao: "Pintura", tipo: "adiantada" })).toBe("Adiantada · Pintura");
    expect(descricaoComTipo({ descricao: "Andaime", tipo: null })).toBe("Andaime");
  });
});
