import { describe, expect, it } from "vitest";
import { equipePrevista, lerEquipeDoForm, validarEquipe } from "@/lib/dominio/equipePrevista";

describe("equipePrevista", () => {
  it("soma por responsável juntando grafias da mesma função", () => {
    const m = equipePrevista([
      { responsavel_id: "r1", equipe: [{ funcao: "Soldador", quantidade: 2 }] },
      { responsavel_id: "r1", equipe: [{ funcao: "soldador ", quantidade: 1 }, { funcao: "Ajudante", quantidade: 1 }] },
      { responsavel_id: null, equipe: [{ funcao: "Vigia", quantidade: 1 }] },
      { responsavel_id: "r2", equipe: [] },
    ]);
    expect(m.get("r1")).toEqual([{ funcao: "Soldador", quantidade: 3 }, { funcao: "Ajudante", quantidade: 1 }]);
    expect(m.get(null)).toEqual([{ funcao: "Vigia", quantidade: 1 }]);
    expect(m.has("r2")).toBe(false);
  });
});

describe("validarEquipe", () => {
  it("vazio é equipe vazia", () => expect(validarEquipe(undefined)).toEqual({ equipe: [], erro: null }));
  it("função obrigatória", () =>
    expect(validarEquipe([{ funcao: "", quantidade: 1 }]).erro).toBe("Informe a função de cada linha da equipe"));
  it("quantidade inteira positiva", () =>
    expect(validarEquipe([{ funcao: "Soldador", quantidade: 1.5 }]).erro).toBe("Quantidade de pessoas inválida"));
  it("limpa espaços", () =>
    expect(validarEquipe([{ funcao: " Soldador ", quantidade: 2 }]).equipe).toEqual([{ funcao: "Soldador", quantidade: 2 }]));
});

describe("lerEquipeDoForm", () => {
  it("lê linhas repetidas, ignora vazias e marca quantidade inválida", () => {
    const f = new FormData();
    for (const [fn, q] of [["Soldador", "2"], ["", ""], ["Ajudante", "1,5"]]) { f.append("funcao", fn); f.append("quantidade", q); }
    const e = lerEquipeDoForm(f);
    expect(e[0]).toEqual({ funcao: "Soldador", quantidade: 2 });
    expect(e).toHaveLength(2);
    expect(Number.isNaN(e[1].quantidade)).toBe(true);
  });
});
