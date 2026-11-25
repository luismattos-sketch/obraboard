import { describe, expect, it } from "vitest";
import { ordenarProblemas, validarProblema, vencido } from "@/lib/dominio/problemas";

describe("validarProblema", () => {
  it("limpa espaços e vazios viram null", () => {
    expect(validarProblema({ tipo: "problema", descricao: "  Andaime ", acao: " ", responsavel: "", prazo: "" })).toEqual({
      ok: true,
      dados: { tipo: "problema", descricao: "Andaime", acao: null, responsavel: null, prazo: null },
    });
  });
  it("recusa tipo, descrição vazia e prazo inválido", () => {
    expect(validarProblema({ tipo: "x", descricao: "a" }).ok).toBe(false);
    expect(validarProblema({ tipo: "oportunidade", descricao: "  " }).ok).toBe(false);
    expect(validarProblema({ tipo: "problema", descricao: "a", prazo: "24/11/2026" }).ok).toBe(false);
  });
});

describe("vencido e ordem", () => {
  const p = (prazo: string | null, resolvido_em: string | null = null, created_at = "2026-11-01") => ({ prazo, resolvido_em, created_at });
  it("vencido só aberto com prazo antes de hoje", () => {
    expect(vencido(p("2026-11-23"), "2026-11-24")).toBe(true);
    expect(vencido(p("2026-11-24"), "2026-11-24")).toBe(false);
    expect(vencido(p("2026-11-01", "2026-11-02"), "2026-11-24")).toBe(false);
    expect(vencido(p(null), "2026-11-24")).toBe(false);
  });
  it("abertos por prazo (sem prazo no fim), resolvidos por último", () => {
    const lista = [p(null), p("2026-11-30"), p("2026-11-01", "2026-11-05"), p("2026-11-20")];
    expect(ordenarProblemas(lista).map((x) => x.prazo)).toEqual(["2026-11-20", "2026-11-30", null, "2026-11-01"]);
  });
});
