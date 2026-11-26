import { describe, it, expect } from "vitest";
import { validarCidade } from "@/lib/db/validacao";

describe("validarCidade", () => {
  it("aceita cidade da lista", () => {
    expect(validarCidade({ nome: "Macaé, Rio de Janeiro", latitude: -22.37, longitude: -41.79 }).ok).toBe(true);
  });
  it("recusa nome vazio, latitude fora e NaN", () => {
    expect(validarCidade({ nome: " ", latitude: -22, longitude: -41 })).toEqual({ ok: false, erro: "Escolha a cidade na lista" });
    expect(validarCidade({ nome: "X", latitude: 91, longitude: -41 }).ok).toBe(false);
    expect(validarCidade({ nome: "X", latitude: -22, longitude: NaN }).ok).toBe(false);
    expect(validarCidade({ nome: "X" }).ok).toBe(false);
  });
});
