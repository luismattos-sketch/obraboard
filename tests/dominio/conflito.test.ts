import { describe, expect, it } from "vitest";
import { notaDigitadoEfetivo, notaDigitadoExecucao, textoConflitoExecucao } from "@/lib/dominio/conflito";
import type { Causa } from "@/lib/dominio/tipos";

const P = "Mudou em outra tela (pode ter sido você em outra aba).";
const v = (q: number | null, c: Causa | null = null, o: string | null = null) => ({ qtd_realizada: q, causa: c, observacao: o });

describe("textoConflitoExecucao", () => {
  it("quantidade diferente", () => {
    expect(textoConflitoExecucao(v(46), v(47), "m")).toBe(`${P} Agora está 46 m, você tinha digitado 47.`);
  });
  it("decimal no banco e em branco na tela", () => {
    expect(textoConflitoExecucao(v(2.5), v(null), "m²")).toBe(`${P} Agora está 2,5 m², você tinha deixado em branco.`);
  });
  it("em branco no banco", () => {
    expect(textoConflitoExecucao(v(null), v(3), "un")).toBe(`${P} Agora está em branco, você tinha digitado 3.`);
  });
  it("causa diferente", () => {
    expect(textoConflitoExecucao(v(5, "material"), v(5, "clima"), "un")).toBe(
      `${P} Agora a causa é Falta material, você tinha escolhido Clima.`,
    );
  });
  it("observação diferente", () => {
    expect(textoConflitoExecucao(v(5, null, "a"), v(5, null, "b"), "un")).toBe(`${P} A observação também foi alterada.`);
  });
  it("várias diferenças na ordem quantidade, causa, observação", () => {
    expect(textoConflitoExecucao(v(46, "material", "a"), v(47, "clima", "b"), "m")).toBe(
      `${P} Agora está 46 m, você tinha digitado 47. Agora a causa é Falta material, você tinha escolhido Clima. A observação também foi alterada.`,
    );
  });
  it("causa removida no banco", () => {
    expect(textoConflitoExecucao(v(5, null), v(5, "clima"), "un")).toBe(`${P} Agora está sem causa, você tinha escolhido Clima.`);
  });
});

describe("notas do que foi digitado", () => {
  it("execução", () => {
    expect(notaDigitadoExecucao(v(47, "clima"))).toBe("Você tinha digitado 47 (causa: Clima).");
    expect(notaDigitadoExecucao(v(47))).toBe("Você tinha digitado 47.");
    expect(notaDigitadoExecucao(v(null, null, "obs"))).toBe('Você tinha digitado: observação "obs".');
    expect(notaDigitadoExecucao(v(2.5, null, "obs"))).toBe('Você tinha digitado 2,5 (observação "obs").');
    expect(notaDigitadoExecucao(v(null))).toBe("Você tinha deixado em branco.");
  });
  it("efetivo", () => {
    expect(
      notaDigitadoEfetivo([
        { funcao: "Pedreiro", quantidade: 7 },
        { funcao: "Servente", quantidade: 2 },
      ]),
    ).toBe("Você tinha digitado: Pedreiro 7, Servente 2.");
    expect(notaDigitadoEfetivo([])).toBe("Você tinha deixado o efetivo vazio.");
  });
});

describe("falhaConflito e mensagens", () => {
  it("carrega os valores atuais", async () => {
    const { falhaConflito } = await import("@/lib/db/resultado");
    const { ERRO_EFETIVO_CONFLITO, ERRO_EXECUCAO_CONFLITO } = await import("@/lib/db/mensagens");
    expect(falhaConflito("x", { a: 1 })).toEqual({ ok: false, erro: "x", conflito: { atual: { a: 1 } } });
    expect(falhaConflito("x")).toEqual({ ok: false, erro: "x", conflito: {} });
    expect(ERRO_EXECUCAO_CONFLITO).toBe(P);
    expect(ERRO_EFETIVO_CONFLITO).toBe("O efetivo mudou em outra tela (pode ter sido você em outra aba).");
  });
});

describe("normalizarExecucao (formato gravado no banco)", () => {
  it("apara a observação e limpa só a causa quando concluída", async () => {
    const { normalizarExecucao } = await import("@/lib/dominio/conflito");
    expect(normalizarExecucao(10, v(4, "clima", "  chuva "))).toEqual(v(4, "clima", "chuva"));
    expect(normalizarExecucao(10, v(4, null, "   "))).toEqual(v(4, null, null));
    expect(normalizarExecucao(10, v(10, "clima", "x"))).toEqual(v(10, null, "x"));
    expect(normalizarExecucao(10, v(null, "clima", "x"))).toEqual(v(null, "clima", "x"));
  });
});

describe("conflito depois de um Somar", () => {
  it("diz o que foi somado e como ficaria sobre o valor atual", () => {
    expect(textoConflitoExecucao(v(50), v(70), "m", 30)).toBe(`${P} Agora está 50 m, você tinha somado +30 (ficaria 80).`);
  });
  it("valor atual em branco: ficaria só o somado", () => {
    expect(textoConflitoExecucao(v(null), v(70), "m", 30)).toBe(`${P} Agora está em branco, você tinha somado +30 (ficaria 30).`);
  });
  it("nota depois de Ver valor atual", () => {
    expect(notaDigitadoExecucao(v(70), 30)).toBe("Você tinha somado +30.");
  });
});
