import { describe, expect, it } from "vitest";
import { campoSemResponsaveis } from "@/lib/dominio/quadro";

describe("campoSemResponsaveis (mesma regra do envio no servidor)", () => {
  it("nenhuma atividade com responsável: fluxo antigo, mesmo com responsável na programação", () => {
    expect(campoSemResponsaveis([{ responsavel_id: null }, { responsavel_id: null }])).toBe(true);
  });
  it("alguma atividade com responsável: envio pelo Terminei", () => {
    expect(campoSemResponsaveis([{ responsavel_id: null }, { responsavel_id: "ana" }])).toBe(false);
  });
});
