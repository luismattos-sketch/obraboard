import { describe, it, expect } from "vitest";
import { parseNumero, hojeSaoPaulo } from "@/lib/dominio/entrada";

describe("parseNumero", () => {
  it("aceita vírgula e ponto decimais", () => {
    expect(parseNumero("2,5")).toBe(2.5);
    expect(parseNumero("2.5")).toBe(2.5);
  });
  it("ignora espaços", () => {
    expect(parseNumero(" 3 ")).toBe(3);
  });
  it("retorna null para vazio, inválido ou negativo", () => {
    expect(parseNumero("")).toBeNull();
    expect(parseNumero("abc")).toBeNull();
    expect(parseNumero("-1")).toBeNull();
  });
});

describe("hojeSaoPaulo", () => {
  it("usa a data local de São Paulo após a meia-noite UTC", () => {
    expect(hojeSaoPaulo(new Date("2026-11-09T01:30:00Z"))).toBe("2026-11-08");
  });
  it("retorna a data no meio do dia", () => {
    expect(hojeSaoPaulo(new Date("2026-11-08T15:00:00Z"))).toBe("2026-11-08");
  });
});
