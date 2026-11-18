import { describe, expect, it } from "vitest";
import { descricaoComTipo } from "@/lib/rdo/formatar";
import { percentualDaFoto } from "@/lib/db/rdo-versoes";

describe("descricaoComTipo", () => {
  it("RDO marca extra", () => {
    expect(descricaoComTipo({ descricao: "Troca de iluminação", tipo: "extra" })).toBe("Extra · Troca de iluminação");
    expect(descricaoComTipo({ descricao: "Pintura", tipo: "adiantada" })).toBe("Adiantada · Pintura");
    expect(descricaoComTipo({ descricao: "Andaime", tipo: null })).toBe("Andaime");
  });
});

describe("percentualDaFoto", () => {
  it("lista de RDOs ignora extra e adiantada como o PDF", () => {
    expect(percentualDaFoto([
      { qtd_planejada: "10", qtd_realizada: "10" },
      { qtd_planejada: 12, qtd_realizada: 12, tipo: "extra" },
      { qtd_planejada: 40, qtd_realizada: null, tipo: "adiantada" },
    ])).toBe(1);
    expect(percentualDaFoto(null)).toBeNull();
  });
});
