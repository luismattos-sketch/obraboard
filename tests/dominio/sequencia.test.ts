import { describe, expect, it } from "vitest";
import { copiasParaAjustar } from "@/lib/dominio/foraDoDia";
import type { AtividadeProgramada, DadosSemana, ExecucaoLigada } from "@/lib/dominio/programacao";
import { agruparSequencias, membrosDaSequencia, metaNoTurno, partesPlanejadas, proximoTurno, textoOrigemMeta } from "@/lib/dominio/sequencia";

// Semana seg 16/11. Andaime: 12 m seg diurno (Luis) → 12 m seg noturno (Alberto).
const INICIO = "2026-11-16";
const ativ = (p: Partial<AtividadeProgramada> = {}): AtividadeProgramada => ({
  id: "d", ordem: 0, descricao: "Montagem de Andaime", local: null, unidade: "m", meta: 12, responsavel_id: "luis",
  dias: [0], periodo: "diurno", causa: null, equipe: [], continua_de: null, ...p,
});
const noite = ativ({ id: "n", periodo: "noturno", responsavel_id: "alberto", continua_de: "d" });
const exec = (p: Partial<ExecucaoLigada> = {}): ExecucaoLigada => ({
  id: "xd", programacao_atividade_id: "d", turno_id: "td", data: INICIO, periodo: "diurno",
  status_turno: "enviado", qtd_planejada: 12, qtd_realizada: null, causa: null, tipo: null, ...p,
});
const dados = (atividades: AtividadeProgramada[], execucoes: ExecucaoLigada[] = []): DadosSemana => ({
  semana: { id: "s1", obra_id: "o1", inicio: INICIO, status: "programada", programada_em: null, encerrada_em: null, motivo_reabertura: null },
  atividades, execucoes, turnos: [],
});
const SEG_N = { id: "tn", data: INICIO, periodo: "noturno" as const };

describe("metaNoTurno", () => {
  it("faltou 4 m no dia → noite com meta 16 m", () => {
    const m = metaNoTurno(dados([ativ(), noite], [exec({ qtd_realizada: 8 })]), "n", SEG_N);
    expect(m.meta).toBe(16);
    expect(m.herdado).toBe(4);
    expect(textoOrigemMeta(m, "m", "Luis")).toBe("inclui 4 m do turno do dia (Luis)");
  });

  it("sobrou 3 m → noite com 9 m", () => {
    const m = metaNoTurno(dados([ativ(), noite], [exec({ qtd_realizada: 15 })]), "n", SEG_N);
    expect(m.meta).toBe(9);
    expect(textoOrigemMeta(m, "m", "Luis")).toBe("desconta 3 m adiantados pelo turno do dia (Luis)");
  });

  it("antes do dia lançar, a noite fica com a parte própria", () => {
    const m = metaNoTurno(dados([ativ(), noite], [exec()]), "n", SEG_N);
    expect(m.meta).toBe(12);
    expect(textoOrigemMeta(m, "m", "Luis")).toBeNull();
    expect(metaNoTurno(dados([ativ(), noite], [exec({ qtd_realizada: 12 })]), "n", SEG_N).meta).toBe(12);
  });

  it("semana toda nos dois turnos: débito passa adiante sem contar duas vezes", () => {
    const dia = ativ({ meta: 60, dias: [0, 1, 2, 3, 4] });
    const noi = ativ({ id: "n", meta: 60, dias: [0, 1, 2, 3, 4], periodo: "noturno", responsavel_id: "alberto", continua_de: "d" });
    const execs = [
      exec({ qtd_realizada: 10 }),
      exec({ id: "xn", programacao_atividade_id: "n", turno_id: "tn", periodo: "noturno", qtd_realizada: 12 }),
    ];
    // Ter diurno: 12 próprio + 2 de débito do seg diurno (a noite de seg cumpriu a própria).
    expect(metaNoTurno(dados([dia, noi], execs), "d", { id: "tt", data: "2026-11-17", periodo: "diurno" }).meta).toBe(14);
  });

  it("último turno fica com todo o saldo; saldo zerado → null", () => {
    expect(metaNoTurno(dados([ativ(), noite], [exec({ qtd_realizada: 30 })]), "n", SEG_N).meta).toBeNull();
  });

  it("sem vínculo segue a regra de sempre", () => {
    const a = ativ({ meta: 120, dias: [0, 1, 2] });
    expect(metaNoTurno(dados([a], [exec({ qtd_realizada: 10 })]), "d", { id: "tt", data: "2026-11-17", periodo: "diurno" }).meta).toBe(40);
  });
});

describe("apoio", () => {
  it("partes planejadas: inteira arredonda para cima e o último dia fica com o resto", () => {
    expect([...partesPlanejadas({ meta: 10, dias: [0, 1, 2] }).values()]).toEqual([4, 4, 2]);
  });

  it("membros e grupos", () => {
    const solta = ativ({ id: "x", continua_de: null });
    const terca = ativ({ id: "t", dias: [1], continua_de: "n" });
    expect(membrosDaSequencia([terca, noite, ativ(), solta], "t").map((a) => a.id)).toEqual(["d", "n", "t"]);
    expect(agruparSequencias([ativ(), solta, noite]).map((g) => g.map((a) => a.id))).toEqual([["d", "n"], ["x"]]);
  });

  it("próximo turno", () => {
    expect(proximoTurno({ dias: [0], periodo: "diurno" })).toEqual({ dias: [0], periodo: "noturno" });
    expect(proximoTurno({ dias: [0], periodo: "noturno" })).toEqual({ dias: [1], periodo: "diurno" });
    expect(proximoTurno({ dias: [6], periodo: "noturno" })).toBeNull();
    expect(proximoTurno({ dias: [0, 1], periodo: "diurno" })).toEqual({ dias: [0, 1], periodo: "noturno" });
  });
});

describe("copiasParaAjustar em sequência", () => {
  it("lançar no dia reajusta a cópia da noite ainda planejada", () => {
    const copia = exec({ id: "cn", programacao_atividade_id: "n", turno_id: "tn", periodo: "noturno", status_turno: "planejado", qtd_planejada: 24 });
    const d = dados([ativ(), noite], [exec({ qtd_realizada: 8 }), copia]);
    const r = copiasParaAjustar(d, "d", { data: INICIO, periodo: "diurno" }, false);
    expect(r.map((x) => [x.atividadeId, x.nova])).toEqual([["cn", 16]]);
  });
});
