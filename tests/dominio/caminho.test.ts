import { describe, expect, it } from "vitest";
import { caminhoSeguro } from "@/lib/dominio/caminho";

describe("caminhoSeguro", () => {
  it("mantém caminho relativo do site", () => {
    expect(caminhoSeguro("/obras/1")).toBe("/obras/1");
  });
  it.each(["//evil.com", "https://evil.com", "/\\evil.com", "", null, undefined])(
    "rejeita %s",
    (v) => {
      expect(caminhoSeguro(v)).toBe("/obras");
    },
  );
  it("usa o padrão informado", () => {
    expect(caminhoSeguro(null, "/x")).toBe("/x");
  });
});
