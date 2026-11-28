import { describe, expect, it } from "vitest";
import { pendentesDeMotivo, restricoesAbertasDoItem, resumoComRestricao, validarMotivoRestricao } from "@/lib/dominio/travaRestricao";

const r = (descricao: string, removida_em: string | null = null) => ({ descricao, responsavel: "Marcos", prazo: null, removida_em });
const porItem = new Map([
  ["A", [r("PT da linha 3"), r("Andaime", "2026-11-20T00:00:00Z")]],
  ["B", [r("Antiga", "2026-11-20T00:00:00Z")]],
]);

describe("restricoesAbertasDoItem", () => {
  it("só as abertas; item sem vínculo não tem", () => {
    expect(restricoesAbertasDoItem("A", porItem)).toEqual([{ descricao: "PT da linha 3", responsavel: "Marcos", prazo: null }]);
    expect(restricoesAbertasDoItem("B", porItem)).toEqual([]);
    expect(restricoesAbertasDoItem(null, porItem)).toEqual([]);
  });
});

describe("pendentesDeMotivo", () => {
  it("lista atividades de item com restrição aberta e sem motivo", () => {
    const atividades = [
      { id: "1", descricao: "Tubulação", cronograma_item_id: "A", justificativa_restricao: null },
      { id: "2", descricao: "Já justificada", cronograma_item_id: "A", justificativa_restricao: "Cliente libera segunda" },
      { id: "3", descricao: "Item livre", cronograma_item_id: "B", justificativa_restricao: null },
      { id: "4", descricao: "Sem lookahead", cronograma_item_id: null, justificativa_restricao: null },
    ];
    expect(pendentesDeMotivo(atividades, porItem)).toEqual([{ id: "1", descricao: "Tubulação", restricoes: ["PT da linha 3"] }]);
  });
});

describe("validarMotivoRestricao", () => {
  it("limpa e limita a 300", () => {
    expect(validarMotivoRestricao("  Cliente libera segunda ")).toBe("Cliente libera segunda");
    expect(validarMotivoRestricao("   ")).toBeNull();
    expect(validarMotivoRestricao("x".repeat(301))).toBeNull();
  });
});

describe("resumoComRestricao", () => {
  it("conta as que entraram com restrição e as cumpridas", () => {
    expect(resumoComRestricao([
      { situacao: "cumprida", justificativa_restricao: "m" },
      { situacao: "em_andamento", justificativa_restricao: "m" },
      { situacao: "cumprida", justificativa_restricao: null },
    ])).toEqual({ total: 2, cumpridas: 1 });
  });
});
