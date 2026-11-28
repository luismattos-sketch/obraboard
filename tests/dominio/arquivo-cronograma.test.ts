import { describe, expect, it } from "vitest";
import { decodificarTexto, lerCsv } from "@/lib/dominio/arquivoCronograma";

describe("leitura de CSV do cronograma", () => {
  it("CSV do Excel pt-BR: ponto e vírgula, BOM e aspas", () => {
    const texto = '﻿EDT;Nome da tarefa;Início\r\n1.1;"Montar; soldar ""tubo""";01/12/2026\r\n';
    expect(lerCsv(texto)).toEqual([
      ["EDT", "Nome da tarefa", "Início"],
      ["1.1", 'Montar; soldar "tubo"', "01/12/2026"],
    ]);
  });
  it("CSV com vírgula", () => {
    expect(lerCsv("Id,Name\n1,Pipe\n")).toEqual([["Id", "Name"], ["1", "Pipe"]]);
  });
  it("decodifica Latin-1 e UTF-8 com BOM", () => {
    const latin1 = new Uint8Array([0x54, 0xe9, 0x72, 0x6d, 0x69, 0x6e, 0x6f]); // "Término" em Latin-1
    expect(decodificarTexto(latin1)).toBe("Término");
    const utf8 = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("Início")]);
    expect(decodificarTexto(utf8)).toBe("Início");
  });
});
