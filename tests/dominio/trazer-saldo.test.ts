import { describe, expect, it } from "vitest";
import type { AtividadeResumida, ResumoSemana } from "@/lib/dominio/programacao";
import { pendentesDaSemanaAnterior, saldoDaOrigem, textoSaldoMudou } from "@/lib/dominio/trazerSaldo";

const ativ = (id: string, meta: number, realizado: number, extra: Partial<AtividadeResumida> = {}): AtividadeResumida => ({
  id,
  ordem: 0,
  descricao: id,
  local: null,
  unidade: "m",
  meta,
  dias: [0],
  periodo: "diurno",
  causa: null,
  responsavel_id: null,
  equipe: [],
  continua_de: null,
  realizado,
  saldo: Math.max(meta - realizado, 0),
  situacao: realizado >= meta ? "cumprida" : realizado > 0 ? "em_andamento" : "sem_execucao",
  causaSugerida: null,
  ...extra,
});

const resumo = (atividades: AtividadeResumida[]): ResumoSemana => ({
  atividades,
  ppc: { cumpridas: 0, total: atividades.length, ppc: null },
  extras: [],
  previstoReal: [],
});

describe("pendentesDaSemanaAnterior", () => {
  it("lista só o que ficou com saldo", () => {
    const r = pendentesDaSemanaAnterior(resumo([ativ("pintura", 120, 100), ativ("piso", 50, 50)]));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ saldo: 20, metaTotal: 120, realizado: 100 });
    expect(r[0].origem.id).toBe("pintura");
  });

  it("sequência entra como um item, com o saldo somado e a origem no último membro", () => {
    const dia = ativ("dia", 12, 8);
    const noite = ativ("noite", 12, 10, { periodo: "noturno", continua_de: "dia" });
    const r = pendentesDaSemanaAnterior(resumo([dia, noite]));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ saldo: 6, metaTotal: 24, realizado: 18 });
    expect(r[0].origem.id).toBe("noite");
  });

  it("sobra de um membro desconta do saldo da sequência", () => {
    const dia = ativ("dia", 12, 15);
    const noite = ativ("noite", 12, 5, { periodo: "noturno", continua_de: "dia" });
    expect(pendentesDaSemanaAnterior(resumo([dia, noite]))[0].saldo).toBe(4);
  });
});

describe("saldoDaOrigem", () => {
  const dia = ativ("dia", 12, 8);
  const meio = ativ("meio", 12, 12, { periodo: "noturno", continua_de: "dia" });
  const fim = ativ("fim", 12, 4, { dias: [1], continua_de: "meio" });
  it("qualquer membro devolve o saldo do grupo", () => {
    expect(saldoDaOrigem(resumo([dia, meio, fim]), "meio")).toBe(12);
  });
  it("id inexistente devolve null", () => {
    expect(saldoDaOrigem(resumo([dia]), "x")).toBeNull();
  });
});

describe("textoSaldoMudou", () => {
  it("igual: nada", () => expect(textoSaldoMudou(20, 20, "m")).toBeNull());
  it("mudou", () => expect(textoSaldoMudou(20, 12, "m")).toBe("Saldo da semana anterior mudou: era 20 m, agora 12 m."));
  it("concluída", () =>
    expect(textoSaldoMudou(20, 0, "m")).toBe("A semana anterior concluiu esta atividade (era 20 m). Apague-a se não for mais necessária."));
});
