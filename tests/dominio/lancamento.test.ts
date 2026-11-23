import { describe, expect, it } from "vitest";
import { perguntaConcluida, somarLancamento, textoSoma, textoTotal } from "@/lib/dominio/lancamento";

const ERRO_NUM = { ok: false, erro: "Digite um número válido" };

describe("somarLancamento", () => {
  it("soma ao total", () => expect(somarLancamento("40", "30")).toEqual({ ok: true, total: 70 }));
  it("total vazio vale 0", () => expect(somarLancamento("", "5")).toEqual({ ok: true, total: 5 }));
  it("aceita vírgula", () => expect(somarLancamento("2,5", "0,5")).toEqual({ ok: true, total: 3 }));
  it("sem erro de ponto flutuante", () => expect(somarLancamento("0,1", "0,2")).toEqual({ ok: true, total: 0.3 }));
  it("quantidade inválida não soma", () => {
    for (const mais of ["0", "-3", "", "x"]) expect(somarLancamento("40", mais)).toEqual(ERRO_NUM);
  });
  it("total inválido pede correção", () =>
    expect(somarLancamento("abc", "3")).toEqual({ ok: false, erro: "Corrija o total antes de somar" }));
});

describe("textos", () => {
  it("prévia da soma", () => {
    expect(textoSoma(40, 30)).toBe("40 + 30 = 70");
    expect(textoSoma(2.5, 0.5)).toBe("2,5 + 0,5 = 3");
  });
  it("pergunta só com parcial abaixo da meta", () => {
    expect(perguntaConcluida(40, 60)).toBe("Trocar 40 por 60?");
    expect(perguntaConcluida(2.5, 4)).toBe("Trocar 2,5 por 4?");
    for (const q of [null, 0, 60, 70]) expect(perguntaConcluida(q, 60)).toBeNull();
  });
  it("total para o campo", () => expect(textoTotal(2.5)).toBe("2,5"));
  it("total para o campo sem ponto de milhar (o campo leria 1.500 como 1,5)", () => expect(textoTotal(1500)).toBe("1500"));
});
