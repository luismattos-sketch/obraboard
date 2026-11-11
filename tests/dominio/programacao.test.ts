import { describe, expect, it } from "vitest";
import {
  causaSugerida,
  dataDoDia,
  diaDaSemana,
  efetivoPrevistoReal,
  encerramentoLiberado,
  normalizarFuncao,
  ppcSemanal,
  realizadoAte,
  resumirSemana,
  rotuloTurnosAbertos,
  situacaoAtividade,
  statusExibido,
  sugestaoDoDia,
  type AtividadeProgramada,
  type DadosSemana,
  type ExecucaoLigada,
  type TurnoDaSemana,
} from "@/lib/dominio/programacao";

const INICIO = "2026-11-09";

const ativ = (p: Partial<AtividadeProgramada> = {}): AtividadeProgramada => ({
  id: "a1", ordem: 0, descricao: "Montar tubulação", local: null, unidade: "m", meta: 10,
  dias: [0, 1], periodo: "diurno", causa: null, equipe: [], ...p,
});

const exec = (p: Partial<ExecucaoLigada> = {}): ExecucaoLigada => ({
  id: "x", programacao_atividade_id: "a1", turno_id: "t1", data: "2026-11-09", periodo: "diurno",
  status_turno: "fechado", qtd_planejada: 5, qtd_realizada: null, causa: null, ...p,
});

const turno = (p: Partial<TurnoDaSemana> = {}): TurnoDaSemana => ({
  id: "t1", data: "2026-11-09", periodo: "diurno", status: "fechado",
  hora_inicio_prevista: "07:00:00", hora_fim_prevista: "17:00:00", hora_inicio_real: null, hora_fim_real: null,
  efetivo: [], extras: [], ...p,
});

const dados = (p: Partial<DadosSemana> = {}): DadosSemana => ({
  semana: { id: "s1", obra_id: "o1", inicio: INICIO, status: "programada", programada_em: null, encerrada_em: null, motivo_reabertura: null },
  atividades: [], execucoes: [], turnos: [], ...p,
});

describe("datas da semana", () => {
  it("dataDoDia e diaDaSemana", () => {
    expect(dataDoDia(INICIO, 0)).toBe("2026-11-09");
    expect(dataDoDia(INICIO, 6)).toBe("2026-11-15");
    expect(diaDaSemana(INICIO, "2026-11-15")).toBe(6);
    expect(diaDaSemana(INICIO, "2026-11-16")).toBeNull();
    expect(diaDaSemana(INICIO, "2026-11-08")).toBeNull();
  });
});

describe("sugestaoDoDia", () => {
  const a = { meta: 120, dias: [0, 1, 2] as const };
  it("divide a meta pelos dias, limitada ao saldo", () => {
    expect(sugestaoDoDia({ ...a, dias: [...a.dias] }, 0, 0)).toBe(40);
    expect(sugestaoDoDia({ ...a, dias: [...a.dias] }, 1, 30)).toBe(40);
    expect(sugestaoDoDia({ meta: 100, dias: [0, 1] }, 0, 90)).toBe(10);
  });
  it("último dia marcado leva o saldo inteiro", () => {
    expect(sugestaoDoDia({ ...a, dias: [...a.dias] }, 2, 70)).toBe(50);
  });
  it("dia não marcado ou saldo zero não sugere", () => {
    expect(sugestaoDoDia({ ...a, dias: [...a.dias] }, 3, 0)).toBeNull();
    expect(sugestaoDoDia({ ...a, dias: [...a.dias] }, 0, 120)).toBeNull();
  });
  it("arredonda em 2 casas", () => {
    expect(sugestaoDoDia({ meta: 10, dias: [0, 1, 2] }, 0, 0)).toBe(3.33);
  });
});

describe("realizadoAte", () => {
  const execs = [
    exec({ qtd_realizada: 3, status_turno: "fechado" }),
    exec({ qtd_realizada: null, status_turno: "enviado" }),
    exec({ qtd_realizada: 2, status_turno: "em_campo" }),
    exec({ programacao_atividade_id: "outra", qtd_realizada: 9 }),
  ];
  it("soma todos os status por padrão; null conta 0", () => {
    expect(realizadoAte(execs, "a1")).toBe(5);
  });
  it("filtra pelos status válidos", () => {
    expect(realizadoAte(execs, "a1", ["enviado", "fechado"])).toBe(3);
  });
});

describe("situação e PPC", () => {
  it("situacaoAtividade", () => {
    expect(situacaoAtividade(10, 0)).toBe("sem_execucao");
    expect(situacaoAtividade(10, 4)).toBe("em_andamento");
    expect(situacaoAtividade(10, 10)).toBe("cumprida");
    expect(situacaoAtividade(10, 12)).toBe("cumprida");
  });
  it("ppcSemanal conta atividades", () => {
    expect(ppcSemanal([{ meta: 10, realizado: 10 }, { meta: 5, realizado: 1 }])).toEqual({ cumpridas: 1, total: 2, ppc: 0.5 });
    expect(ppcSemanal([])).toEqual({ cumpridas: 0, total: 0, ppc: null });
  });
});

describe("causaSugerida", () => {
  it("pega a causa do último turno com causa (noturno depois do diurno)", () => {
    expect(
      causaSugerida([
        exec({ data: "2026-11-10", periodo: "noturno", causa: "clima" }),
        exec({ data: "2026-11-10", periodo: "diurno", causa: "material" }),
        exec({ data: "2026-11-11", periodo: "diurno", causa: null }),
      ]),
    ).toBe("clima");
  });
  it("sem causa → null", () => {
    expect(causaSugerida([exec(), exec({ data: "2026-11-10" })])).toBeNull();
  });
});

describe("normalizarFuncao", () => {
  it("ignora acentos, caixa e espaços", () => {
    expect(normalizarFuncao("  Caldeirêiro   Montador ")).toBe("caldeireiro montador");
  });
});

describe("efetivoPrevistoReal", () => {
  const d = dados({
    atividades: [
      ativ({ id: "a1", dias: [0, 1], equipe: [{ funcao: "Caldeireiro", quantidade: 2 }] }),
      ativ({ id: "a2", dias: [0], equipe: [{ funcao: "caldeireiro ", quantidade: 1 }, { funcao: "Ajudante", quantidade: 2 }] }),
    ],
    turnos: [turno({ efetivo: [{ funcao: "Caldeireiro", quantidade: 2 }, { funcao: "Soldador", quantidade: 1 }] })],
  });

  it("compara por dia, período e função, com HH", () => {
    const blocos = efetivoPrevistoReal(d);
    expect(blocos.map((b) => [b.data, b.periodo])).toEqual([["2026-11-09", "diurno"], ["2026-11-10", "diurno"]]);
    const seg = blocos[0];
    expect(seg.semTurno).toBe(false);
    expect(seg.funcoes).toEqual([
      { funcao: "Caldeireiro", previsto: 3, real: 2, diferenca: -1 },
      { funcao: "Ajudante", previsto: 2, real: 0, diferenca: -2 },
      { funcao: "Soldador", previsto: 0, real: 1, diferenca: 1 },
    ]);
    expect(seg.hhPrevisto).toBe(50);
    expect(seg.hhReal).toBe(30);
  });

  it("dia marcado sem turno: real em branco, não zero", () => {
    const ter = efetivoPrevistoReal(d)[1];
    expect(ter.semTurno).toBe(true);
    expect(ter.funcoes).toEqual([{ funcao: "Caldeireiro", previsto: 2, real: null, diferenca: null }]);
    expect(ter.hhPrevisto).toBeNull();
    expect(ter.hhReal).toBeNull();
  });

  it("noturno vem depois do diurno na mesma data", () => {
    const b = efetivoPrevistoReal(
      dados({ atividades: [ativ({ dias: [0], periodo: "noturno" })], turnos: [turno()] }),
    );
    expect(b.map((x) => x.periodo)).toEqual(["diurno", "noturno"]);
  });
});

describe("resumirSemana", () => {
  it("realizado só conta enviado/fechado; extras fora do PPC", () => {
    const r = resumirSemana(
      dados({
        atividades: [ativ({ id: "a1", meta: 10 }), ativ({ id: "a2", meta: 5, dias: [1] })],
        execucoes: [
          exec({ programacao_atividade_id: "a1", qtd_realizada: 10, status_turno: "fechado" }),
          exec({ programacao_atividade_id: "a2", data: "2026-11-10", qtd_realizada: 5, status_turno: "em_campo", causa: "clima" }),
        ],
        turnos: [turno({ extras: [{ id: "e1", descricao: "Extra", unidade: null, qtd_planejada: 1, qtd_realizada: 1 }] })],
      }),
    );
    expect(r.atividades.map((a) => [a.id, a.realizado, a.saldo, a.situacao])).toEqual([
      ["a1", 10, 0, "cumprida"],
      ["a2", 0, 5, "sem_execucao"],
    ]);
    expect(r.atividades[1].causaSugerida).toBe("clima");
    expect(r.ppc).toEqual({ cumpridas: 1, total: 2, ppc: 0.5 });
    expect(r.extras).toEqual([{ id: "e1", descricao: "Extra", unidade: null, qtd_planejada: 1, qtd_realizada: 1, data: "2026-11-09", periodo: "diurno" }]);
  });
});

describe("status e encerramento", () => {
  it("statusExibido", () => {
    expect(statusExibido("programada", INICIO, "2026-11-16")).toBe("aguardando_encerramento");
    expect(statusExibido("programada", INICIO, "2026-11-15")).toBe("programada");
    expect(statusExibido("encerrada", INICIO, "2026-11-20")).toBe("encerrada");
    expect(statusExibido("rascunho", INICIO, "2026-11-20")).toBe("rascunho");
  });
  it("encerramentoLiberado a partir do último dia marcado", () => {
    expect(encerramentoLiberado([{ dias: [0, 2] }], INICIO, "2026-11-10")).toBe(false);
    expect(encerramentoLiberado([{ dias: [0, 2] }], INICIO, "2026-11-11")).toBe(true);
    expect(encerramentoLiberado([], INICIO, "2026-11-20")).toBe(false);
  });
  it("rotuloTurnosAbertos", () => {
    expect(
      rotuloTurnosAbertos([
        turno({ data: "2026-11-11", periodo: "noturno", status: "enviado" }),
        turno({ data: "2026-11-10", status: "em_campo" }),
        turno({ status: "fechado" }),
      ]),
    ).toBe("10/11 diurno, 11/11 noturno");
    expect(rotuloTurnosAbertos([turno()])).toBeNull();
  });
});
