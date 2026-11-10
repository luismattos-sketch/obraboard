import { describe, expect, it } from "vitest";
import { deveRemoverUsuario } from "@/lib/db/empresas";

describe("deveRemoverUsuario", () => {
  it("falha na consulta: não remove", () => {
    expect(deveRemoverUsuario({ ok: false, erro: "x", etapa: "consulta" })).toBe(false);
  });
  it("falha na criação: remove", () => {
    expect(deveRemoverUsuario({ ok: false, erro: "x", etapa: "criacao" })).toBe(true);
  });
  it("sucesso: não remove", () => {
    expect(deveRemoverUsuario({ ok: true, dados: { empresaId: "e", criada: false } })).toBe(false);
  });
});
