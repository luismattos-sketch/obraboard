import { describe, expect, it } from "vitest";
import { ESQUEMA_RESPOSTA, lerRespostaIA, montarPedido, type ItemIA } from "@/lib/ia/esquema";
import { CAUSAS } from "@/lib/dominio/tipos";

const item: ItemIA = {
  atividade: "A1",
  candidatas: [],
  quantidade: 30,
  unidade_dita: "m",
  modo: "total",
  concluida: false,
  causa: null,
  causas_candidatas: ["material", "equipamento"],
  coisa_da_causa: "andaime",
  trecho: "faltou andaime",
};

describe("lerRespostaIA", () => {
  it("aceita a resposta completa", () => {
    expect(lerRespostaIA({ itens: [item] })).toEqual({ itens: [item] });
  });

  it.each([
    ["item sem trecho", { itens: [{ ...item, trecho: undefined }] }],
    ["causa inventada", { itens: [{ ...item, causa: "inventada" }] }],
    ["modo inválido", { itens: [{ ...item, modo: "x" }] }],
    ["itens não-array", { itens: "x" }],
    ["quantidade em texto", { itens: [{ ...item, quantidade: "30" }] }],
    ["candidata de causa inventada", { itens: [{ ...item, causas_candidatas: ["chuva"] }] }],
    ["nulo", null],
  ])("recusa %s", (_n, json) => {
    expect(lerRespostaIA(json)).toBeNull();
  });
});

describe("montarPedido", () => {
  const p = montarPedido("fizemos 30 m", [
    { codigo: "A1", descricao: "Tubulação linha 3", local: null, unidade: "m", meta: 50, feito: null, tipo: null },
  ]);

  it("lista as atividades e o relato entre marcadores", () => {
    expect(p.user).toContain("A1");
    expect(p.user).toContain("Tubulação linha 3");
    expect(p.user).toContain("meta 50 m");
    expect(p.user).toContain("<relato>\nfizemos 30 m\n</relato>");
  });

  it("explica as causas e proíbe inventar", () => {
    for (const [chave, rotulo] of Object.entries(CAUSAS)) {
      expect(p.system).toContain(chave);
      expect(p.system).toContain(rotulo);
    }
    expect(p.system).toContain("nunca invente números, atividades ou causas; o que não foi dito fica null");
  });
});

describe("ESQUEMA_RESPOSTA", () => {
  it("exige todas as chaves do item", () => {
    const itens = (ESQUEMA_RESPOSTA.properties as Record<string, { items: { required: string[] } }>).itens;
    expect([...itens.items.required].sort()).toEqual(Object.keys(item).sort());
  });
});
