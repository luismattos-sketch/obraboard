import { describe, expect, it } from "vitest";
import { dimensoesReduzidas, ehJpeg, FOTO_MAX_BYTES, validarFoto } from "@/lib/dominio/foto";

describe("dimensoesReduzidas", () => {
  it("paisagem grande vira 1280 no lado maior", () => {
    expect(dimensoesReduzidas(4000, 3000)).toEqual({ largura: 1280, altura: 960 });
  });
  it("retrato grande", () => {
    expect(dimensoesReduzidas(3000, 4000)).toEqual({ largura: 960, altura: 1280 });
  });
  it("pequena não aumenta", () => {
    expect(dimensoesReduzidas(800, 600)).toEqual({ largura: 800, altura: 600 });
  });
});

describe("validarFoto", () => {
  it("JPEG até 2 MB", () => {
    expect(validarFoto({ type: "image/jpeg", size: 300_000 })).toEqual({ ok: true, dados: undefined });
    expect(FOTO_MAX_BYTES).toBe(2 * 1024 * 1024);
  });
  it("sem arquivo", () => {
    expect(validarFoto(null)).toEqual({ ok: false, erro: "Envie uma foto" });
    expect(validarFoto({ type: "image/jpeg", size: 0 })).toEqual({ ok: false, erro: "Envie uma foto" });
  });
  it("tipo errado", () => {
    expect(validarFoto({ type: "image/gif", size: 1000 })).toEqual({ ok: false, erro: "Envie uma foto" });
  });
  it("grande demais", () => {
    expect(validarFoto({ type: "image/jpeg", size: 2 * 1024 * 1024 + 1 })).toEqual({ ok: false, erro: "Foto muito grande" });
  });
});

describe("ehJpeg", () => {
  it("reconhece o começo de um JPEG", () => {
    expect(ehJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(ehJpeg(new Uint8Array([0x3c, 0x68, 0x74]))).toBe(false);
    expect(ehJpeg(new Uint8Array([0xff]))).toBe(false);
  });
});
