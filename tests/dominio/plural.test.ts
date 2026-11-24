import { describe, expect, it } from "vitest";
import { pessoas, plural, qtdComUnidade } from "@/lib/dominio/plural";

describe("plural", () => {
  it("palavras por extenso", () => {
    expect(qtdComUnidade(8, "tubo")).toBe("8 tubos");
    expect(pessoas(2, "Soldador")).toBe("2 Soldadores");
    expect(pessoas(3, "Meio-oficial")).toBe("3 Meio-oficiais");
    expect(plural(4, "peça")).toBe("peças");
    expect(pessoas(0, "Pedreiro")).toBe("0 Pedreiros");
  });
  it("singular abaixo de 2", () => {
    expect(qtdComUnidade(1, "tubo")).toBe("1 tubo");
    expect(qtdComUnidade(1.5, "tubo")).toBe("1,5 tubo");
    expect(pessoas(1, "Soldador")).toBe("1 Soldador");
  });
  it("abreviações ficam iguais", () => {
    for (const u of ["m", "m²", "m³", "un", "kg", "ml", "vb", "pç", "ton"]) expect(qtdComUnidade(10, u)).toBe(`10 ${u}`);
    expect(qtdComUnidade(3, "")).toBe("3");
  });
});
