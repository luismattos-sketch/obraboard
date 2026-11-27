import { describe, expect, it } from "vitest";
import { descricaoComTipo, porResponsavel } from "@/lib/rdo/formatar";
import { percentualDaFoto } from "@/lib/db/rdo-versoes";

describe("descricaoComTipo", () => {
  it("RDO marca extra", () => {
    expect(descricaoComTipo({ descricao: "Troca de iluminação", tipo: "extra" })).toBe("Extra · Troca de iluminação");
    expect(descricaoComTipo({ descricao: "Pintura", tipo: "adiantada" })).toBe("Adiantada · Pintura");
    expect(descricaoComTipo({ descricao: "Andaime", tipo: null })).toBe("Andaime");
  });
});

describe("porResponsavel", () => {
  it("agrupa atividades e efetivo por responsável, sem responsável por último", () => {
    const g = porResponsavel(
      [{ d: 1, responsavel_id: null }, { d: 2, responsavel_id: "ana" }, { d: 3, responsavel_id: "rita" }, { d: 4, responsavel_id: "ana" }],
      [{ f: "Pedreiro", responsavel_id: "rita" }, { f: "Servente" }],
    );
    expect(g.map((x) => x.id)).toEqual(["ana", "rita", null]);
    expect(g[0].atividades.map((a) => a.d)).toEqual([2, 4]);
    expect(g[1].efetivo.map((e) => e.f)).toEqual(["Pedreiro"]);
    expect(g[2].efetivo.map((e) => e.f)).toEqual(["Servente"]);
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
