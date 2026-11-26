import { describe, expect, it } from "vitest";
import { decidirRepeticao, MSG_SEM_SINAL, textoPendentes } from "@/components/execucao/repeticao";
import { erroBanco } from "@/lib/db/mensagens";
import {
  causaValida,
  errosDeTamanho,
  falhaCampos,
  horaValida,
  validarEfetivoEsperado,
  validarHorariosPrevistos,
} from "@/lib/db/validacao";
import { tuplaEfetivo, tuplaExecucao, tuplaHorario } from "@/lib/dominio/assinatura";

describe("decidirRepeticao (auto-salvamento)", () => {
  it("nunca desiste e aumenta o intervalo até 30 s", () => {
    let f = 0;
    const vistos: number[] = [];
    for (let i = 0; i < 8; i++) {
      const d = decidirRepeticao(f, true);
      vistos.push(d.emMs);
      f = d.falhas;
    }
    expect(vistos).toEqual([5000, 10000, 20000, 30000, 30000, 30000, 30000, 30000]);
    expect(f).toBe(8);
  });
  it("sem conexão espera 30 s sem contar falha", () => {
    expect(decidirRepeticao(2, false)).toEqual({ falhas: 2, emMs: 30000 });
  });
  it("texto do aviso no topo", () => {
    expect(textoPendentes(1)).toBe("⚠ 1 lançamento não salvo. Não feche nem atualize esta tela.");
    expect(textoPendentes(2)).toBe("⚠ 2 lançamentos não salvos. Não feche nem atualize esta tela.");
    expect(MSG_SEM_SINAL).toBe("Não salvo — sem sinal. Tentando de novo…");
  });
});


describe("erroBanco", () => {
  it("reconhece só exceções P0001 conhecidas", () => {
    expect(erroBanco({ code: "P0001", message: "turno_fechado" })).toBe("turno_fechado");
    expect(erroBanco({ code: "P0001", message: "causa_pendente" })).toBe("causa_pendente");
    expect(erroBanco({ code: "P0001", message: "efetivo_conflito" })).toBe("efetivo_conflito");
    expect(erroBanco({ code: "P0001", message: "outra" })).toBeNull();
    expect(erroBanco({ code: "23505", message: "turno_fechado" })).toBeNull();
    expect(erroBanco(null)).toBeNull();
  });
});

describe("validação do planejador", () => {
  it("causa usa Object.hasOwn (não aceita chaves herdadas)", () => {
    expect(causaValida("material")).toBe(true);
    expect(causaValida("toString")).toBe(false);
    expect(causaValida("__proto__")).toBe(false);
    expect(causaValida(1)).toBe(false);
  });
  it("limites de tamanho por campo", () => {
    const erros = errosDeTamanho({
      descricao: { valor: "x".repeat(201), max: 200 },
      local: { valor: "x".repeat(100), max: 100 },
      unidade: { valor: null, max: 20 },
    });
    expect(erros).toEqual({ descricao: "Máximo de 200 caracteres" });
    expect(falhaCampos(erros)).toEqual({
      ok: false,
      erro: "Máximo de 200 caracteres",
      campos: { descricao: "Máximo de 200 caracteres" },
    });
    expect(falhaCampos({})).toBeNull();
  });
  it("horários previstos HH:MM (vazio permitido)", () => {
    expect(horaValida("07:00")).toBe(true);
    expect(horaValida("24:00")).toBe(false);
    expect(horaValida("7:00")).toBe(false);
    expect(validarHorariosPrevistos({ hora_inicio_prevista: "07:00", hora_fim_prevista: "" }).ok).toBe(true);
    expect(validarHorariosPrevistos({ hora_inicio_prevista: null }).ok).toBe(true);
    expect(validarHorariosPrevistos({ hora_inicio_prevista: "7h" })).toEqual({ ok: false, erro: "Horário inválido" });
  });
  it("efetivo esperado só confere o formato", () => {
    expect(validarEfetivoEsperado([{ funcao: "Pedreiro", quantidade: 2 }]).ok).toBe(true);
    expect(validarEfetivoEsperado([{ funcao: "Pedreiro", quantidade: 1.5 }]).ok).toBe(false);
    expect(validarEfetivoEsperado("x" as never).ok).toBe(false);
  });
});

describe("assinaturas (local x servidor)", () => {
  it("execução: o que a tela envia equivale ao que o banco guarda", () => {
    // concluída: banco limpa a causa e guarda a observação
    expect(tuplaExecucao(10, 10, "material", "x")).toEqual(tuplaExecucao(10, 10, null, "x"));
    // parcial: observação aparada
    expect(tuplaExecucao(10, 4, "clima", "  chuva ")).toEqual([4, "clima", "chuva"]);
    expect(tuplaExecucao(10, null, "", "  ")).toEqual([null, null, null]);
    // texto inválido nunca coincide com valor do banco
    expect(tuplaExecucao(10, "4,", null, null)).not.toEqual(tuplaExecucao(10, 4, null, null));
  });
  it("efetivo ignora a ordem e espaços", () => {
    expect(tuplaEfetivo([{ funcao: "Servente", quantidade: 2 }, { funcao: " Pedreiro", quantidade: 3 }])).toEqual(
      tuplaEfetivo([{ funcao: "Pedreiro", quantidade: 3 }, { funcao: "Servente", quantidade: 2 }]),
    );
  });
  it("horário", () => {
    expect(tuplaHorario("", "17:00")).toEqual([null, "17:00"]);
  });
});
