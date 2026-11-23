import { describe, expect, it } from "vitest";
import type { ItemIA } from "@/lib/ia/esquema";
import { aplicarRespostas, codigosParaIA, conferirRelato, linhasComRespostas, type AtividadeRelato } from "@/lib/dominio/relato";

const T: AtividadeRelato = { id: "t", descricao: "Tubulação linha 3", local: null, unidade: "m", qtd_planejada: 50, qtd_realizada: null, causa: null, observacao: null, tipo: null };
const S: AtividadeRelato = { id: "s", descricao: "Suporte de tubo", local: null, unidade: "un", qtd_planejada: 8, qtd_realizada: null, causa: null, observacao: null, tipo: null };
const K: AtividadeRelato = { id: "k", descricao: "Chapa de piso", local: null, unidade: "kg", qtd_planejada: 100, qtd_realizada: null, causa: null, observacao: null, tipo: null };

const base: ItemIA = {
  atividade: "A1", candidatas: [], quantidade: null, unidade_dita: null, modo: null, concluida: false,
  causa: null, causas_candidatas: [], coisa_da_causa: null, trecho: null,
};
const it_ = (p: Partial<ItemIA>): ItemIA => ({ ...base, ...p });

describe("codigosParaIA", () => {
  it("numera na ordem recebida", () => {
    expect([...codigosParaIA([T, S]).entries()].map(([c, a]) => [c, a.id])).toEqual([["A1", "t"], ["A2", "s"]]);
  });
});

describe("conferirRelato", () => {
  const andaime = it_({ quantidade: 30, unidade_dita: "m", modo: "total", causas_candidatas: ["material", "equipamento"], coisa_da_causa: "andaime", trecho: "faltou andaime" });

  it("30 m com causa ambígua: prévia, uma pergunta e a atividade não citada", () => {
    const p = conferirRelato({ itens: [andaime] }, [T, S]);
    expect(p.itens).toHaveLength(1);
    expect(p.itens[0].depois?.qtd_realizada).toBe(30);
    expect(p.itens[0].linha).toBe("Tubulação linha 3 — 0 → 30 m de 50 m (parcial)");
    expect(p.perguntas).toHaveLength(1);
    const q = p.perguntas[0];
    expect(q.tipo).toBe("causa");
    expect(q.texto).toBe("Andaime é…");
    if (q.tipo !== "causa") throw new Error();
    expect(q.opcoes).toEqual([
      { causa: "material", rotulo: "Falta material" },
      { causa: "equipamento", rotulo: "Equipamento (falta ou quebra)" },
      { causa: "outro", rotulo: "Outra" },
    ]);
    expect(p.semCitar).toEqual(["Suporte de tubo"]);
    expect(p.semNada).toBe(false);
  });

  it("aplicar a resposta da causa gera a gravação com o esperado de antes", () => {
    const p = conferirRelato({ itens: [andaime] }, [T, S]);
    const r = aplicarRespostas(p, { [p.perguntas[0].chave]: "material" });
    expect(r.faltam).toEqual([]);
    expect(r.gravar).toEqual([
      { atividadeId: "t", dados: { qtd_realizada: 30, causa: "material", observacao: "faltou andaime" }, esperado: { qtd_realizada: null, causa: null, observacao: null } },
    ]);
  });

  it("já havia 40 e modo incerto: pergunta somar ou trocar", () => {
    const p = conferirRelato({ itens: [it_({ quantidade: 30, modo: "incerto" })] }, [{ ...T, qtd_realizada: 40 }]);
    expect(p.perguntas).toEqual([expect.objectContaining({ tipo: "modo", texto: "30 m a mais ou no total?", somar: 70, trocar: 30 })]);
    expect(p.itens[0].linha).toBe("Tubulação linha 3 — 40 → ? m de 50 m");
    expect(linhasComRespostas(p, { [p.perguntas[0].chave]: "trocar" })[p.itens[0].chave]).toBe("Tubulação linha 3 — 40 → 30 m de 50 m (parcial)");
    expect(linhasComRespostas(p, {})[p.itens[0].chave]).toBe("Tubulação linha 3 — 40 → ? m de 50 m");
    expect(aplicarRespostas(p, { [p.perguntas[0].chave]: "somar" }).gravar[0].dados.qtd_realizada).toBe(70);
    expect(aplicarRespostas(p, { [p.perguntas[0].chave]: "trocar" }).gravar[0].dados.qtd_realizada).toBe(30);
  });

  it("modo a_mais soma sem perguntar", () => {
    const p = conferirRelato({ itens: [it_({ quantidade: 30, modo: "a_mais" })] }, [{ ...T, qtd_realizada: 40 }]);
    expect(p.perguntas).toEqual([]);
    expect(aplicarRespostas(p, {}).gravar[0].dados.qtd_realizada).toBe(70);
  });

  it("citada sem número: pergunta a quantidade (extra sem 'Tudo')", () => {
    const p = conferirRelato({ itens: [it_({})] }, [T]);
    expect(p.perguntas).toEqual([expect.objectContaining({ tipo: "quantidade", texto: "Quanto de Tubulação linha 3?", tudo: 50 })]);
    expect(aplicarRespostas(p, { [p.perguntas[0].chave]: 12 }).gravar[0].dados.qtd_realizada).toBe(12);
    const e = conferirRelato({ itens: [it_({})] }, [{ ...T, tipo: "extra" }]);
    expect(e.perguntas[0]).toMatchObject({ tipo: "quantidade", tudo: null });
  });

  it("atividade ambígua: pergunta qual, depois aplica na escolhida", () => {
    const p = conferirRelato({ itens: [it_({ atividade: null, candidatas: ["A1", "A2"], quantidade: 5 })] }, [T, S]);
    expect(p.perguntas).toEqual([
      expect.objectContaining({ tipo: "atividade", opcoes: [{ id: "t", rotulo: "Tubulação linha 3" }, { id: "s", rotulo: "Suporte de tubo" }] }),
    ]);
    const r = aplicarRespostas(p, { [p.perguntas[0].chave]: "s" });
    expect(r.gravar).toEqual([expect.objectContaining({ atividadeId: "s", dados: expect.objectContaining({ qtd_realizada: 5 }) })]);
  });

  it("no máximo 2 perguntas; a 3ª dúvida vira falta e não grava", () => {
    const p = conferirRelato(
      {
        itens: [
          it_({ atividade: null, candidatas: ["A1", "A2"], quantidade: 5 }),
          it_({ atividade: "A3", quantidade: 10, unidade_dita: "kg", causas_candidatas: ["material", "clima"], coisa_da_causa: "chuva" }),
          it_({ atividade: "A4" }),
        ],
      },
      [T, S, K, { ...T, id: "t2", descricao: "Tubulação linha 4" }],
    );
    expect(p.perguntas.map((q) => q.tipo)).toEqual(["atividade", "causa"]);
    expect(p.faltas).toEqual(["Tubulação linha 4: diga quanto foi feito — complete no card"]);
    const r = aplicarRespostas(p, { [p.perguntas[0].chave]: "t", [p.perguntas[1].chave]: "clima" });
    expect(r.gravar.map((g) => g.atividadeId)).toEqual(["t", "k"]);
  });

  it.each([
    ["código inexistente", it_({ atividade: "A9", quantidade: 3 }), [T], "Não achei a atividade citada — complete no card"],
    ["quantidade zero", it_({ quantidade: 0 }), [T], "Tubulação linha 3: quantidade inválida — complete no card"],
    ["quantidade enorme", it_({ quantidade: 2e9 }), [T], "Tubulação linha 3: quantidade inválida — complete no card"],
    ["unidade diferente", it_({ quantidade: 3, unidade_dita: "peças" }), [K], "Chapa de piso: unidade diferente (peças, a atividade é em kg) — complete no card"],
  ])("%s vira falta", (_n, ia, ativs, falta) => {
    const p = conferirRelato({ itens: [ia] }, ativs);
    expect(p.faltas).toEqual([falta]);
    expect(aplicarRespostas(p, {}).gravar).toEqual([]);
  });

  it("aceita sinônimos de unidade sem acento e minúsculas", () => {
    const p1 = conferirRelato({ itens: [it_({ quantidade: 3, unidade_dita: "Metros" })] }, [T]);
    expect(p1.faltas).toEqual([]);
    const p2 = conferirRelato({ itens: [it_({ quantidade: 3, unidade_dita: "peças" })] }, [S]);
    expect(p2.faltas).toEqual([]);
  });

  it("aceita decimal", () => {
    const p = conferirRelato({ itens: [it_({ quantidade: 2.5, modo: "total" })] }, [T]);
    expect(p.itens[0].linha).toBe("Tubulação linha 3 — 0 → 2,5 m de 50 m (parcial)");
  });

  it("concluída: quantidade vira a meta e sem causa", () => {
    const p = conferirRelato({ itens: [it_({ concluida: true, causa: "material" })] }, [T]);
    expect(p.perguntas).toEqual([]);
    expect(aplicarRespostas(p, {}).gravar[0].dados).toEqual({ qtd_realizada: 50, causa: null, observacao: null });
  });

  it("já concluída: não muda e avisa", () => {
    const p = conferirRelato({ itens: [it_({ concluida: true })] }, [{ ...T, qtd_realizada: 50 }]);
    expect(p.itens[0].linha).toBe("Tubulação linha 3 — já estava concluída");
    expect(aplicarRespostas(p, {}).gravar).toEqual([]);
  });

  it("extra e adiantada não recebem causa", () => {
    for (const tipo of ["extra", "adiantada"] as const) {
      const p = conferirRelato({ itens: [it_({ quantidade: 5, modo: "total", causas_candidatas: ["material", "equipamento"] })] }, [{ ...T, tipo }]);
      expect(p.perguntas).toEqual([]);
      expect(aplicarRespostas(p, {}).gravar[0].dados.causa).toBeNull();
    }
  });

  it("observação junta com a anterior; grande demais não muda", () => {
    const p = conferirRelato({ itens: [it_({ quantidade: 3, modo: "total", causa: "material", trecho: "faltou andaime" })] }, [{ ...T, observacao: "x" }]);
    expect(aplicarRespostas(p, {}).gravar[0].dados.observacao).toBe("x · faltou andaime");
    const grande = conferirRelato({ itens: [it_({ atividade: "A1", quantidade: 3, modo: "total", causa: "material", trecho: "faltou andaime" })] }, [{ ...S, unidade: "m", observacao: "y".repeat(490) }]);
    expect(grande.faltas).toEqual(["Suporte de tubo: observação grande demais — complete no card"]);
    expect(aplicarRespostas(grande, {}).gravar[0].dados.observacao).toBe("y".repeat(490));
  });

  it("nada para lançar", () => {
    expect(conferirRelato({ itens: [] }, [T]).semNada).toBe(true);
  });

  it("pergunta sem resposta fica em faltam e o item não grava", () => {
    const p = conferirRelato({ itens: [andaime] }, [T]);
    const r = aplicarRespostas(p, {});
    expect(r.faltam).toEqual([p.perguntas[0].chave]);
    expect(r.gravar).toEqual([]);
  });
});
