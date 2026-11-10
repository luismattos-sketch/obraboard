import { describe, it, expect } from "vitest";
import { gerarToken, hashToken } from "@/lib/dominio/token";

describe("gerarToken", () => {
  it("gera 43 caracteres base64url", () => {
    expect(gerarToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it("gera tokens distintos", () => {
    expect(gerarToken()).not.toBe(gerarToken());
  });
});

describe("hashToken", () => {
  it("é o SHA-256 em hex", () => {
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
