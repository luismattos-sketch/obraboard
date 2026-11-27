import { describe, it, expect } from "vitest";
import { hhDoExtra, textoHHExtra, textoMateriais, validarHHExtra, validarMateriais } from "@/lib/dominio/extraApontamento";
import { somaHHExtra } from "@/lib/dominio/resumo";

describe("validarHHExtra", () => {
  it("vazio é nulo; os dois juntos; limites", () => {
    expect(validarHHExtra("", null)).toEqual({ extra_pessoas: null, extra_horas: null });
    expect(validarHHExtra(3, 1.5)).toEqual({ extra_pessoas: 3, extra_horas: 1.5 });
    expect(validarHHExtra(3, "")).toMatchObject({ campo: "hh" });
    expect(validarHHExtra(2.5, 1)).toMatchObject({ erro: "Pessoas: número inteiro de 1 a 500" });
    expect(validarHHExtra(2, 25)).toMatchObject({ erro: "Horas: mais que 0 e até 24" });
    expect(validarHHExtra(2, "abc")).toMatchObject({ campo: "hh" });
  });
});

describe("validarMateriais", () => {
  it("ignora linha vazia, apara e recusa incompleta", () => {
    expect(validarMateriais([{ item: " cabo ", quantidade: 10, unidade: " m " }, { item: "", quantidade: "", unidade: "" }])).toEqual({
      materiais: [{ item: "cabo", quantidade: 10, unidade: "m" }],
    });
    expect(validarMateriais(undefined)).toEqual({ materiais: [] });
    expect(validarMateriais([{ item: "cabo", quantidade: "", unidade: "m" }])).toMatchObject({ erro: 'Informe a quantidade de "cabo"' });
    expect(validarMateriais([{ item: "cabo", quantidade: 1, unidade: "" }])).toMatchObject({ erro: 'Informe a unidade de "cabo"' });
    expect(validarMateriais([{ item: "", quantidade: 1, unidade: "m" }])).toMatchObject({ campo: "materiais" });
    expect(validarMateriais(Array.from({ length: 21 }, () => ({ item: "x", quantidade: 1, unidade: "un" })))).toMatchObject({ erro: "Máximo de 20 materiais" });
  });
});

describe("textos e soma", () => {
  it("HH e material legíveis; soma só dos extras apontados", () => {
    expect(hhDoExtra({ extra_pessoas: 3, extra_horas: 1.5 })).toBe(4.5);
    expect(textoHHExtra({ extra_pessoas: 3, extra_horas: 1.5 })).toBe("4,5 HH (3 pessoas × 1,5 h)");
    expect(textoHHExtra({ extra_pessoas: 1, extra_horas: 2 })).toBe("2 HH (1 pessoa × 2 h)");
    expect(textoHHExtra({ extra_pessoas: null, extra_horas: null })).toBeNull();
    expect(textoMateriais([{ item: "cabo", quantidade: 10, unidade: "m" }, { item: "luminária", quantidade: 4, unidade: "un" }])).toBe("10 m de cabo; 4 un de luminária");
    expect(textoMateriais([])).toBeNull();
    expect(
      somaHHExtra([
        { tipo: "extra", extra_pessoas: 3, extra_horas: 2 },
        { tipo: "extra", extra_pessoas: null, extra_horas: null },
        { tipo: null, extra_pessoas: 9, extra_horas: 9 },
        { tipo: "extra", extra_pessoas: 1, extra_horas: 0.5 },
      ]),
    ).toBe(6.5);
    expect(somaHHExtra([{ tipo: "extra", extra_pessoas: null, extra_horas: null }])).toBeNull();
  });
});
