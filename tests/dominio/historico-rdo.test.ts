import { describe, expect, it } from "vitest";
import { agruparVersoes, lerEmPaginas, mesesDisponiveis, normalizarMes, rotuloMes, type ItemVersao } from "@/lib/dominio/historico-rdo";

const item = (over: Partial<ItemVersao>): ItemVersao => ({
  id: "v", turnoId: "t", obraId: "o", obraNome: "Obra", numero: 1, emitidoEm: "2026-11-09T21:40:00Z",
  retroativa: false, data: "2026-11-09", periodo: "diurno", turnoStatus: "fechado", percentual: 0.5, ...over,
});

describe("normalizarMes", () => {
  it("aceita AAAA-MM", () => expect(normalizarMes("2026-11")).toBe("2026-11"));
  it.each([["2026-13"], ["2026-1"], ["abc"], [undefined], [["2026-11"]], ["2026-00"]])("recusa %j", (v) => {
    expect(normalizarMes(v)).toBeNull();
  });
});

describe("mesesDisponiveis", () => {
  it("únicos, mais recente primeiro", () => {
    expect(mesesDisponiveis([{ data: "2026-10-31" }, { data: "2026-11-02" }, { data: "2026-11-09" }])).toEqual(["2026-11", "2026-10"]);
  });
});

describe("agruparVersoes", () => {
  const a1 = item({ id: "a1", turnoId: "A", numero: 1, data: "2026-11-09", obraNome: "Nome antigo" });
  const a2 = item({ id: "a2", turnoId: "A", numero: 2, data: "2026-11-09", obraNome: "Nome novo" });
  const b1 = item({ id: "b1", turnoId: "B", numero: 1, data: "2026-10-31" });

  it("agrupa por turno com a versão atual e as anteriores", () => {
    const g = agruparVersoes([a1, b1, a2], null);
    expect(g.map((x) => x.turnoId)).toEqual(["A", "B"]);
    expect(g[0].atual.id).toBe("a2");
    expect(g[0].obraNome).toBe("Nome novo");
    expect(g[0].anteriores.map((x) => x.numero)).toEqual([1]);
    expect(g[0].reaberto).toBe(false);
    expect(g[1].anteriores).toEqual([]);
  });
  it("filtra pelo mês da data do turno", () => {
    expect(agruparVersoes([a1, a2, b1], "2026-10").map((x) => x.turnoId)).toEqual(["B"]);
    expect(agruparVersoes([a1, a2, b1], "2025-01")).toEqual([]);
  });
  it("marca turno reaberto", () => {
    expect(agruparVersoes([item({ turnoStatus: "enviado" })], null)[0].reaberto).toBe(true);
  });
  it("mesmo dia: noturno antes de diurno (mais recente primeiro)", () => {
    const d = item({ id: "d", turnoId: "D", periodo: "diurno" });
    const n = item({ id: "n", turnoId: "N", periodo: "noturno" });
    expect(agruparVersoes([d, n], null).map((x) => x.turnoId)).toEqual(["N", "D"]);
  });
});

describe("rotuloMes", () => {
  it("por extenso", () => expect(rotuloMes("2026-11")).toBe("novembro de 2026"));
});

describe("lerEmPaginas", () => {
  it("busca página a página até vir uma página incompleta", async () => {
    const dados = Array.from({ length: 2500 }, (_, i) => i);
    const pedidos: [number, number][] = [];
    const tudo = await lerEmPaginas(async (de, ate) => {
      pedidos.push([de, ate]);
      return dados.slice(de, ate + 1);
    }, 1000);
    expect(tudo).toHaveLength(2500);
    expect(pedidos).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
  it("lista vazia: um pedido só", async () => {
    let n = 0;
    expect(await lerEmPaginas(async () => { n++; return []; }, 1000)).toEqual([]);
    expect(n).toBe(1);
  });
});
