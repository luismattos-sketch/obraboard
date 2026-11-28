import { describe, expect, it } from "vitest";
import { ordenarRestricoes, restricaoVencida, resumoRestricoes, validarRestricao } from "@/lib/dominio/restricoes";

const base = { tipo: "liberacao_area", descricao: "PT da área 2", responsavel: "Marcos (cliente)", prazo: "2026-12-01" };

describe("validarRestricao", () => {
  it("aceita e limpa os campos", () => {
    expect(validarRestricao({ ...base, descricao: "  PT da área 2 ", prazo: "" })).toEqual({
      ok: true, dados: { tipo: "liberacao_area", descricao: "PT da área 2", responsavel: "Marcos (cliente)", prazo: null },
    });
  });
  it("recusa responsável vazio, tipo desconhecido, descrição longa e prazo inválido", () => {
    expect(validarRestricao({ ...base, responsavel: "   " })).toMatchObject({ ok: false, campos: { responsavel: "Informe o responsável" } });
    expect(validarRestricao({ ...base, tipo: "chuva" })).toMatchObject({ ok: false, campos: { tipo: "Escolha o tipo" } });
    expect(validarRestricao({ ...base, descricao: "x".repeat(301) }).ok).toBe(false);
    expect(validarRestricao({ ...base, responsavel: "x".repeat(101) }).ok).toBe(false);
    expect(validarRestricao({ ...base, prazo: "2026-02-31" })).toMatchObject({ ok: false, campos: { prazo: "Prazo inválido" } });
  });
});

describe("vencida e resumo", () => {
  it("vencida = aberta com prazo antes de hoje; removida nunca vence", () => {
    expect(restricaoVencida({ prazo: "2026-11-26", removida_em: null }, "2026-11-27")).toBe(true);
    expect(restricaoVencida({ prazo: "2026-11-27", removida_em: null }, "2026-11-27")).toBe(false);
    expect(restricaoVencida({ prazo: null, removida_em: null }, "2026-11-27")).toBe(false);
    expect(restricaoVencida({ prazo: "2026-11-01", removida_em: "2026-11-20T10:00:00Z" }, "2026-11-27")).toBe(false);
  });
  it("conta abertas e vencidas", () => {
    expect(resumoRestricoes([
      { prazo: "2026-11-01", removida_em: null },
      { prazo: null, removida_em: null },
      { prazo: "2026-11-01", removida_em: "2026-11-20T10:00:00Z" },
    ], "2026-11-27")).toEqual({ abertas: 2, vencidas: 1 });
  });
});

describe("ordenarRestricoes", () => {
  it("abertas primeiro, por prazo (sem prazo no fim), depois removidas", () => {
    const r = (id: string, prazo: string | null, removida_em: string | null = null) => ({ id, prazo, removida_em, created_at: "2026-11-27T10:00:00Z" });
    const lista = [r("rem", "2026-11-01", "2026-11-20T00:00:00Z"), r("semPrazo", null), r("tarde", "2026-12-10"), r("cedo", "2026-12-01")];
    expect(ordenarRestricoes(lista).map((x) => x.id)).toEqual(["cedo", "tarde", "semPrazo", "rem"]);
  });
});
