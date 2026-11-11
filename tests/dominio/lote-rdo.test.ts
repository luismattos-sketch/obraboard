import { describe, expect, it } from "vitest";
import type { ItemVersao } from "@/lib/dominio/historico-rdo";
import { paginasIniciais, selecionarLote } from "@/lib/dominio/lote-rdo";
import { nomeArquivoLote } from "@/lib/rdo/nome-arquivo";

const item = (over: Partial<ItemVersao>): ItemVersao => ({
  id: "v", turnoId: "t", obraId: "o", obraNome: "Obra", numero: 1, emitidoEm: "2026-11-09T21:40:00Z",
  retroativa: false, data: "2026-11-09", periodo: "diurno", turnoStatus: "fechado", percentual: 0.5, ...over,
});

describe("selecionarLote", () => {
  const a1 = item({ id: "a1", turnoId: "A", numero: 1, emitidoEm: "2026-11-09T10:00:00Z" });
  const a2 = item({ id: "a2", turnoId: "A", numero: 2, emitidoEm: "2026-11-10T10:00:00Z" });
  const b1 = item({ id: "b1", turnoId: "B", numero: 1, data: "2026-11-03" });

  it("só a versão atual, com a anterior", () => {
    const l = selecionarLote([a1, a2, b1], "2026-11", null);
    expect(l).toHaveLength(2);
    const a = l.find((x) => x.atual.turnoId === "A")!;
    expect(a.atual.id).toBe("a2");
    expect(a.anterior).toEqual({ numero: 1, emitido_em: "2026-11-09T10:00:00Z" });
    expect(l.find((x) => x.atual.turnoId === "B")!.anterior).toBeUndefined();
  });

  it("filtra mês e obra", () => {
    const out = item({ id: "out", turnoId: "X", data: "2026-10-31" });
    const o2 = item({ id: "o2", turnoId: "Y", obraId: "o2" });
    expect(selecionarLote([out, b1, o2], "2026-11", null).map((x) => x.atual.id)).toEqual(["b1", "o2"]);
    expect(selecionarLote([out, b1, o2], "2026-11", "o2").map((x) => x.atual.id)).toEqual(["o2"]);
  });

  it("ordem obra → data → período", () => {
    const itens = [
      item({ id: "beta01", turnoId: "1", obraId: "o2", obraNome: "Beta", data: "2026-11-01" }),
      item({ id: "alfa09n", turnoId: "2", obraId: "o1", obraNome: "Alfa", data: "2026-11-09", periodo: "noturno" }),
      item({ id: "alfa09d", turnoId: "3", obraId: "o1", obraNome: "Alfa", data: "2026-11-09" }),
      item({ id: "alfa02d", turnoId: "4", obraId: "o1", obraNome: "Alfa", data: "2026-11-02" }),
    ];
    expect(selecionarLote(itens, "2026-11", null).map((x) => x.atual.id)).toEqual(["alfa02d", "alfa09d", "alfa09n", "beta01"]);
  });

  it("obra renomeada fica junta", () => {
    const itens = [
      item({ id: "z", turnoId: "1", obraId: "o1", obraNome: "Zeta", data: "2026-11-02", emitidoEm: "2026-11-02T10:00:00Z" }),
      item({ id: "b", turnoId: "2", obraId: "o2", obraNome: "Beta", data: "2026-11-01", emitidoEm: "2026-11-05T10:00:00Z" }),
      item({ id: "a", turnoId: "3", obraId: "o1", obraNome: "Alfa", data: "2026-11-09", emitidoEm: "2026-11-09T10:00:00Z" }),
    ];
    expect(selecionarLote(itens, "2026-11", null).map((x) => x.atual.id)).toEqual(["z", "a", "b"]);
  });

  it("reaberto", () => {
    const l = selecionarLote([item({ turnoStatus: "enviado" })], "2026-11", null);
    expect(l[0].reaberto).toBe(true);
  });
});

describe("paginasIniciais", () => {
  it("soma a capa e os RDOs anteriores", () => {
    expect(paginasIniciais(1, [2, 1, 3])).toEqual([2, 4, 5]);
    expect(paginasIniciais(2, [1])).toEqual([3]);
    expect(paginasIniciais(1, [])).toEqual([]);
  });
});

describe("nomeArquivoLote", () => {
  it("obra ou todas as obras", () => {
    expect(nomeArquivoLote("Edifício Aurora 🏗", "2026-11")).toBe("RDOs-edificio-aurora-2026-11.pdf");
    expect(nomeArquivoLote(null, "2026-11")).toBe("RDOs-todas-as-obras-2026-11.pdf");
  });
});
