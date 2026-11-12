import { describe, expect, it } from "vitest";
import { canonizarFuncao, funcoesDaProgramacao, unirFuncoes, type AtividadeProgramada } from "@/lib/dominio/programacao";

const ativ = (p: Partial<AtividadeProgramada> = {}): AtividadeProgramada => ({
  id: "a1", ordem: 0, descricao: "x", local: null, unidade: "m", meta: 10,
  dias: [0], periodo: "diurno", causa: null, equipe: [], ...p,
});

describe("unirFuncoes", () => {
  it("junta listas sem repetir grafias equivalentes, mantendo a primeira", () => {
    expect(unirFuncoes(["Mecânico", "Soldador"], ["mecanico", " Pedreiro ", "SOLDADOR", ""])).toEqual([
      "Mecânico",
      "Soldador",
      "Pedreiro",
    ]);
  });
});

describe("funcoesDaProgramacao", () => {
  it("põe primeiro as funções do dia/período do turno e depois as do resto da semana", () => {
    const atividades = [
      ativ({ dias: [1], equipe: [{ funcao: "Eletricista", quantidade: 1 }] }),
      ativ({ dias: [0], periodo: "noturno", equipe: [{ funcao: "Vigia", quantidade: 1 }] }),
      ativ({ dias: [0, 1], equipe: [{ funcao: "Mecânico", quantidade: 2 }, { funcao: "eletricista", quantidade: 1 }] }),
    ];
    expect(funcoesDaProgramacao(atividades, 0, "diurno")).toEqual(["Mecânico", "eletricista", "Vigia"]);
  });

  it("sem dia (turno fora da semana) devolve todas as funções", () => {
    expect(funcoesDaProgramacao([ativ({ equipe: [{ funcao: "Pintor", quantidade: 1 }] })], null, "diurno")).toEqual(["Pintor"]);
  });
});

describe("canonizarFuncao", () => {
  const opcoes = ["Mecânico", "Soldador"];
  it("usa a grafia cadastrada quando só muda acento, maiúscula ou espaços", () => {
    expect(canonizarFuncao("  mecanico ", opcoes)).toBe("Mecânico");
  });
  it("mantém o texto (aparado) quando é uma função nova", () => {
    expect(canonizarFuncao(" Andaimeiro  ", opcoes)).toBe("Andaimeiro");
  });
});
