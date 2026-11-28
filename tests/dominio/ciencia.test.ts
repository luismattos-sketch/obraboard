import { describe, it, expect } from "vitest";
import { agruparPorSemana, dataHoraCiencia, validarNomeCiencia } from "@/lib/dominio/ciencia";

describe("ciência do cliente", () => {
  it("nome: apara, junta espaços, obrigatório, até 100", () => {
    expect(validarNomeCiencia("  Marcos   Lima, fiscal ")).toEqual({ ok: true, nome: "Marcos Lima, fiscal" });
    expect(validarNomeCiencia(" ")).toEqual({ ok: false, erro: "Escreva seu nome e função" });
    expect(validarNomeCiencia("a".repeat(101)).ok).toBe(false);
  });

  it("agrupa por segunda-feira, mais recente primeiro, com o link da semana", () => {
    expect(
      agruparPorSemana(
        [
          { data: "2026-11-18", ciente: true },
          { data: "2026-11-22", ciente: false },
          { data: "2026-11-24", ciente: false },
        ],
        [{ semana: "2026-11-16", codigo: "abc" }, { semana: "2026-11-02", codigo: "velho" }],
      ),
    ).toEqual([
      { semana: "2026-11-23", extras: 1, cientes: 0, codigo: null },
      { semana: "2026-11-16", extras: 2, cientes: 1, codigo: "abc" },
    ]);
  });

  it("data e hora em Brasília", () => {
    expect(dataHoraCiencia("2026-11-27T13:05:00Z")).toBe("27/11/2026 10:05");
  });
});
