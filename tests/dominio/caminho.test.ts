import { describe, expect, it } from "vitest";
import { caminhoSeguro } from "@/lib/dominio/caminho";

describe("caminhoSeguro", () => {
  it("mantém caminho relativo do site", () => {
    expect(caminhoSeguro("/obras/1")).toBe("/obras/1");
  });
  it.each([
    "//evil.com",
    "https://evil.com",
    "/\\evil.com",
    "",
    null,
    undefined,
    "/\t/evil.com",
    "/\n/evil.com",
    "/\r/evil.com",
  ])("rejeita %j", (v) => {
    expect(caminhoSeguro(v)).toBe("/obras");
  });
  it("mantém caminho com query e hash", () => {
    expect(caminhoSeguro("/obras?x=1#a")).toBe("/obras?x=1#a");
  });
  it("nunca resolve fora do site com %09 literal", () => {
    const r = caminhoSeguro("/%09/evil.com");
    expect(new URL(r, "http://x").origin).toBe("http://x");
  });
  it("usa o padrão informado", () => {
    expect(caminhoSeguro(null, "/x")).toBe("/x");
  });
});

describe("caminhoSeguro com query", () => {
  it("preserva a query do download em lote", () => {
    expect(caminhoSeguro("/api/rdo/lote?mes=2026-11&obra=x")).toBe("/api/rdo/lote?mes=2026-11&obra=x");
  });
});
