import { describe, expect, it } from "vitest";
import {
  adivinharMapeamento,
  diasDoItemNaSemana,
  itensDaSemana,
  lerData,
  lerLinhas,
  lerQuantidade,
  mudouDesdeLevado,
  planoReimportacao,
  semanasDoLookahead,
  type ItemCronograma,
  type ItemLido,
} from "@/lib/dominio/cronograma";

describe("adivinharMapeamento", () => {
  it("reconhece a exportação do Project em português", () => {
    expect(adivinharMapeamento(["EDT", "Nome da tarefa", "Início", "Término"])).toEqual({ codigo: 0, descricao: 1, inicio: 2, fim: 3 });
  });
  it("reconhece a exportação do Primavera em inglês, com local", () => {
    expect(adivinharMapeamento(["Activity ID", "Activity Name", "Start", "Finish", "Area"])).toEqual({
      codigo: 0, descricao: 1, inicio: 2, fim: 3, local: 4,
    });
  });
  it("prefere EDT a Id quando os dois existem", () => {
    expect(adivinharMapeamento(["Id", "EDT", "Nome", "Início", "Término"]).codigo).toBe(1);
  });
});

describe("lerData", () => {
  it("lê o formato do Project com dia da semana e hora", () => expect(lerData("seg 02/12/26 08:00")).toBe("2026-12-02"));
  it("lê o número serial do Excel", () => expect(lerData(46096)).toBe("2026-03-15"));
  it("lê ISO e dd/mm/aaaa", () => {
    expect(lerData("2026-12-02")).toBe("2026-12-02");
    expect(lerData("02/12/2026")).toBe("2026-12-02");
  });
  it("recusa data impossível", () => expect(lerData("32/01/2026")).toBeNull());
  it("lê Date do read-excel-file pelo dia em UTC (célula só com data)", () => {
    expect(lerData(new Date(Date.UTC(2026, 11, 1)))).toBe("2026-12-01");
  });
});

describe("lerLinhas", () => {
  const m = { codigo: 0, descricao: 1, inicio: 2, fim: 3, quantidade: 4 };
  it("ignora linha sem código e código repetido, e lê quantidade em pt-BR", () => {
    const r = lerLinhas(
      [
        ["", "Sem código", "01/12/2026", "02/12/2026", ""],
        ["1.1", "Montar tubulação", "01/12/2026", "05/12/2026", "1.234,5"],
        ["1.1", "Repetido", "01/12/2026", "05/12/2026", ""],
        ["1.2", "Data ruim", "xx", "05/12/2026", ""],
        ["1.3", "Fim antes", "05/12/2026", "01/12/2026", ""],
      ],
      m,
    );
    expect(r.itens).toHaveLength(1);
    expect(r.itens[0]).toMatchObject({ codigo: "1.1", descricao: "Montar tubulação", inicio: "2026-12-01", fim: "2026-12-05", quantidade: 1234.5 });
    expect(r.ignoradas).toEqual([
      { linha: 2, motivo: "sem código" },
      { linha: 4, motivo: "código repetido" },
      { linha: 5, motivo: "data inválida" },
      { linha: 6, motivo: "fim antes do início" },
    ]);
  });
});

describe("lerQuantidade", () => {
  it("aceita ponto decimal do teclado do celular e milhar com vírgula decimal", () => {
    expect(lerQuantidade("1.5")).toBe(1.5);
    expect(lerQuantidade("1,5")).toBe(1.5);
    expect(lerQuantidade("1.234,5")).toBe(1234.5);
    expect(lerQuantidade("")).toBeNull();
    expect(lerQuantidade("0")).toBeNull();
  });
});

describe("planoReimportacao", () => {
  const lido = (codigo: string, descricao = `Item ${codigo}`): ItemLido => ({
    codigo, descricao, inicio: "2026-12-01", fim: "2026-12-05", local: null, unidade: null, quantidade: null,
  });
  const existente = (codigo: string | null, extra: Partial<ItemCronograma> = {}): ItemCronograma => ({
    ...lido(codigo ?? "x"), codigo, id: codigo ?? "m", origem: codigo ? "importado" : "manual",
    removido_em: null, updated_at: "2026-11-27T10:00:00Z", ...extra,
  });
  it("mesmo conteúdo não muda nada", () => {
    expect(planoReimportacao([existente("A")], [lido("A")])).toEqual({ novos: 0, atualizados: 0, removidos: 0 });
  });
  it("conta novo, atualizado, removido e o que volta; ignora manuais", () => {
    const ex = [existente("A"), existente("B"), existente("C", { removido_em: "2026-11-20T00:00:00Z" }), existente(null)];
    expect(planoReimportacao(ex, [lido("A", "Outro nome"), lido("C"), lido("D")])).toEqual({ novos: 1, atualizados: 2, removidos: 1 });
  });
});

describe("janela do lookahead", () => {
  it("começa na semana seguinte à de hoje", () => {
    expect(semanasDoLookahead("2026-11-27", 4)).toEqual(["2026-11-30", "2026-12-07", "2026-12-14", "2026-12-21"]);
  });
  it("item longo aparece em todas; item que acaba no domingo anterior não aparece", () => {
    const longo = { inicio: "2026-11-01", fim: "2027-01-31" };
    const acabou = { inicio: "2026-11-20", fim: "2026-11-29" };
    for (const s of semanasDoLookahead("2026-11-27", 6)) expect(itensDaSemana([longo, acabou], s)).toEqual([longo]);
  });
  it("dias do item dentro da semana (0 = segunda)", () => {
    expect(diasDoItemNaSemana({ inicio: "2026-12-02", fim: "2026-12-04" }, "2026-11-30")).toEqual([2, 3, 4]);
    expect(diasDoItemNaSemana({ inicio: "2026-11-01", fim: "2027-01-31" }, "2026-11-30")).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("mudouDesdeLevado", () => {
  it("compara a última mudança do item com a última atividade levada", () => {
    expect(mudouDesdeLevado({ updated_at: "2026-12-02T10:00:00Z" }, "2026-12-01T10:00:00Z")).toBe(true);
    expect(mudouDesdeLevado({ updated_at: "2026-12-01T10:00:00Z" }, "2026-12-02T10:00:00Z")).toBe(false);
    expect(mudouDesdeLevado({ updated_at: "2026-12-02T10:00:00Z" }, null)).toBe(false);
  });
});
