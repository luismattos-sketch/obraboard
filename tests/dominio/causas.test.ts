import { describe, expect, it } from "vitest";
import { CAUSAS, GRUPO_CAUSA, type Causa } from "@/lib/dominio/tipos";

describe("causas em linguagem simples", () => {
  it("rótulos novos (códigos iguais)", () => {
    expect(CAUSAS).toEqual({
      material: "Falta material",
      mao_de_obra: "Falta de gente",
      equipamento: "Equipamento (falta ou quebra)",
      projeto_informacao: "Falta projeto / informação",
      clima: "Clima",
      atividade_predecessora: "Aguardando outra equipe",
      liberacao_area: "Área não liberada / interferência",
      seguranca: "Segurança",
      outro: "Outro",
    });
  });

  it("grupo interna/externa", () => {
    expect(GRUPO_CAUSA.material).toBe("externa");
    expect(GRUPO_CAUSA.atividade_predecessora).toBe("externa");
    expect(GRUPO_CAUSA.mao_de_obra).toBe("interna");
    expect(GRUPO_CAUSA.equipamento).toBe("interna");
    expect(GRUPO_CAUSA.outro).toBeNull();
    expect(Object.keys(GRUPO_CAUSA).sort()).toEqual((Object.keys(CAUSAS) as Causa[]).sort());
  });
});
