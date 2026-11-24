import { describe, expect, it } from "vitest";
import { ultimaAlteracao, ultimaAlteracaoClima, ultimaAlteracaoEfetivo } from "@/lib/dominio/ultimaAlteracao";

const nome = (id: string) => (id === "ana" ? "Ana" : "?");

describe("ultimaAlteracao", () => {
  it("sem hora: sem selo", () => {
    expect(ultimaAlteracao({ lancado_por_id: "ana", lancado_em: null }, nome)).toBeNull();
  });
  it("responsável, no fuso de São Paulo", () => {
    expect(ultimaAlteracao({ lancado_por_id: "ana", lancado_em: "2026-11-23T12:12:00Z" }, nome)).toBe("Ana · 09:12");
  });
  it("planejador", () => {
    expect(ultimaAlteracao({ lancado_por_id: null, lancado_em: "2026-11-23T13:05:00Z" }, nome)).toBe("você · 10:05");
  });
});

describe("ultimaAlteracaoClima", () => {
  it("sem registro com hora: sem selo", () => {
    expect(ultimaAlteracaoClima([{ lancado_por_id: "ana", lancado_em: null }], nome)).toBeNull();
  });
  it("vale o período alterado por último", () => {
    expect(
      ultimaAlteracaoClima([{ lancado_por_id: null, lancado_em: "2026-11-23T11:00:00Z" }, { lancado_por_id: "ana", lancado_em: "2026-11-23T13:15:00Z" }], nome),
    ).toBe("Ana · 10:15");
  });
});

describe("ultimaAlteracaoEfetivo", () => {
  it("sem linhas: sem selo", () => {
    expect(ultimaAlteracaoEfetivo([], "Ana")).toBeNull();
  });
  it("usa a linha mais recente", () => {
    expect(
      ultimaAlteracaoEfetivo(
        [
          { lancado_pelo_planejador: false, created_at: "2026-11-23T11:00:00Z" },
          { lancado_pelo_planejador: true, created_at: "2026-11-23T14:30:00Z" },
        ],
        "Ana",
      ),
    ).toBe("você · 11:30");
    expect(ultimaAlteracaoEfetivo([{ lancado_pelo_planejador: false, created_at: "2026-11-23T11:00:00Z" }], "Ana")).toBe("Ana · 08:00");
  });
});
