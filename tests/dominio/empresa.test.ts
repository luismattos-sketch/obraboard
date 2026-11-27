import { describe, expect, it } from "vitest";
import { validarNomeEmpresa } from "@/lib/dominio/empresa";
import { LIMITES, mensagemMaximo } from "@/lib/db/validacao";

describe("validarNomeEmpresa", () => {
  it("apara espaços", () => {
    expect(validarNomeEmpresa("  Acme  ")).toEqual({ ok: true, nome: "Acme" });
  });
  it("só espaços conta como vazio", () => {
    expect(validarNomeEmpresa("   ")).toEqual({ ok: false, erro: "Informe o nome da empresa." });
  });
  it("respeita o limite do cadastro", () => {
    expect(validarNomeEmpresa("x".repeat(LIMITES.empresa + 1))).toEqual({ ok: false, erro: mensagemMaximo(LIMITES.empresa) });
    expect(validarNomeEmpresa("x".repeat(LIMITES.empresa)).ok).toBe(true);
  });
});
