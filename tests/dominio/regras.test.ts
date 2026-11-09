import { describe, it, expect } from "vitest";
import { errosDeCausa, transicaoTurno, compararTurnos } from "@/lib/dominio/regras";
import type { AtividadeExec } from "@/lib/dominio/tipos";

const a = (p: Partial<AtividadeExec>): AtividadeExec => ({
  id: "1",
  descricao: "x",
  qtd_planejada: 10,
  qtd_realizada: 10,
  causa: null,
  observacao: null,
  ...p,
});

describe("errosDeCausa", () => {
  it("sem erros para atividade concluída", () => {
    expect(errosDeCausa([a({})])).toEqual({});
  });
  it("exige causa para atividade não concluída", () => {
    expect(errosDeCausa([a({ qtd_realizada: 3 })])).toEqual({
      "1": "Informe a causa para atividades não concluídas",
    });
  });
  it("exige observação quando a causa é outro", () => {
    expect(errosDeCausa([a({ qtd_realizada: 0, causa: "outro" })])).toEqual({
      "1": "Descreva a causa na observação",
    });
  });
  it("aceita causa informada", () => {
    expect(errosDeCausa([a({ qtd_realizada: 0, causa: "clima" })])).toEqual({});
  });
});

describe("transicaoTurno", () => {
  it("liberar exige ao menos uma atividade", () => {
    expect(transicaoTurno("planejado", "liberar", { atividades: [] })).toEqual({
      ok: false,
      erro: "Adicione ao menos uma atividade",
    });
  });
  it("liberar leva planejado a em_campo", () => {
    expect(
      transicaoTurno("planejado", "liberar", { atividades: [a({ qtd_realizada: null })] }),
    ).toEqual({ ok: true, novo: "em_campo" });
  });
  it("enviar exige causas informadas", () => {
    expect(
      transicaoTurno("em_campo", "enviar", { atividades: [a({ qtd_realizada: 2 })] }),
    ).toEqual({ ok: false, erro: "Há atividades sem causa informada" });
  });
  it("fechar a partir de enviado", () => {
    expect(transicaoTurno("enviado", "fechar", { atividades: [a({})] })).toEqual({
      ok: true,
      novo: "fechado",
    });
  });
  it("fechar a partir de em_campo", () => {
    expect(transicaoTurno("em_campo", "fechar", { atividades: [a({})] })).toEqual({
      ok: true,
      novo: "fechado",
    });
  });
  it("reabrir leva fechado a enviado", () => {
    expect(transicaoTurno("fechado", "reabrir", { atividades: [] })).toEqual({
      ok: true,
      novo: "enviado",
    });
  });
  it("recusa ações não permitidas para o status", () => {
    expect(transicaoTurno("fechado", "enviar", { atividades: [a({})] })).toEqual({
      ok: false,
      erro: "Ação não permitida para turno Fechado",
    });
  });
});

describe("compararTurnos", () => {
  it("ordena por data e depois diurno antes de noturno", () => {
    expect(
      [
        { data: "2026-11-08", periodo: "noturno" as const },
        { data: "2026-11-08", periodo: "diurno" as const },
        { data: "2026-11-07", periodo: "noturno" as const },
      ]
        .sort(compararTurnos)
        .map((t) => t.data + t.periodo),
    ).toEqual(["2026-11-07noturno", "2026-11-08diurno", "2026-11-08noturno"]);
  });
});
