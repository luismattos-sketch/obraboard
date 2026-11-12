import { describe, expect, it } from "vitest";
import { ERRO_MOTIVO, rotuloAtor, rotuloEvento, validarMotivo } from "@/lib/dominio/eventos";

describe("validarMotivo", () => {
  it.each([[""], ["   "], ["ab"], [undefined], [123]])("recusa %j", (v) => {
    expect(validarMotivo(v)).toEqual({ ok: false, erro: ERRO_MOTIVO });
  });
  it("aplica trim", () => expect(validarMotivo("  abc  ")).toEqual({ ok: true, dados: "abc" }));
  it("aceita 500 e recusa 501", () => {
    expect(validarMotivo("x".repeat(500)).ok).toBe(true);
    expect(validarMotivo("x".repeat(501))).toEqual({ ok: false, erro: "O motivo pode ter até 500 caracteres" });
  });
});

describe("rotuloEvento", () => {
  it.each([
    ["criado", null, "Turno criado"],
    ["liberado", null, "Link liberado para o campo"],
    ["novo_link", null, "Novo link gerado (o anterior parou de funcionar)"],
    ["enviado", null, "Enviado pelo campo"],
    ["fechado", 2, "Fechado · RDO v2 emitido"],
    ["fechado", null, "Fechado"],
    ["reaberto", null, "Reaberto"],
  ] as const)("%s", (tipo, versao, rotulo) => {
    expect(rotuloEvento({ tipo, versao })).toBe(rotulo);
  });
});

describe("rotuloAtor", () => {
  it("planejador com nome", () => expect(rotuloAtor({ atorTipo: "planejador", atorNome: "Luis" })).toBe("Luis"));
  it("encarregado", () => expect(rotuloAtor({ atorTipo: "encarregado", atorNome: null })).toBe("Equipe de campo (link)"));
  it("planejador sem nome", () => expect(rotuloAtor({ atorTipo: "planejador", atorNome: null })).toBe("—"));
});
