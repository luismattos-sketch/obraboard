import { describe, it, expect } from "vitest";
import {
  analisarObra,
  inicioDaSemana,
  normalizarSemanas,
  semanasDaAnalise,
  type AtividadeAnalise,
  type TurnoAnalise,
} from "@/lib/dominio/analise";
import { hojeSaoPaulo } from "@/lib/dominio/entrada";
import type { Causa, Periodo, StatusTurno } from "@/lib/dominio/tipos";

const a = (plan: number, real: number | null, causa: Causa | null = null, obs: string | null = null, descricao = "X"): AtividadeAnalise => ({
  descricao,
  qtd_planejada: plan,
  qtd_realizada: real,
  causa,
  observacao: obs,
});
const t = (id: string, data: string, periodo: Periodo, atividades: AtividadeAnalise[], status: StatusTurno = "fechado"): TurnoAnalise => ({
  id,
  data,
  periodo,
  status,
  atividades,
});

// Semanas de 26/10, 02/11 e 09/11/2026 (segundas-feiras).
const SEMANAS = ["2026-10-26", "2026-11-02", "2026-11-09"];

describe("normalizarSemanas", () => {
  it("aceita 4, 8 e 12 e cai em 8 no resto", () => {
    expect(normalizarSemanas("4")).toBe(4);
    expect(normalizarSemanas("12")).toBe(12);
    expect(normalizarSemanas("8")).toBe(8);
    expect(normalizarSemanas(undefined)).toBe(8);
    expect(normalizarSemanas("99")).toBe(8);
    expect(normalizarSemanas("abc")).toBe(8);
    expect(normalizarSemanas(["12", "4"])).toBe(8);
  });
});

describe("inicioDaSemana", () => {
  it("devolve a segunda-feira da semana (seg a dom)", () => {
    expect(inicioDaSemana("2026-11-09")).toBe("2026-11-09");
    expect(inicioDaSemana("2026-11-15")).toBe("2026-11-09");
    expect(inicioDaSemana("2026-11-11")).toBe("2026-11-09");
    expect(inicioDaSemana("2026-01-01")).toBe("2025-12-29");
  });
});

describe("semanasDaAnalise", () => {
  it("lista N segundas em ordem crescente terminando na semana de hoje", () => {
    expect(semanasDaAnalise("2026-11-15", 3)).toEqual(SEMANAS);
  });
  it("domingo à noite em São Paulo ainda é a semana que começou na segunda anterior", () => {
    expect(semanasDaAnalise(hojeSaoPaulo(new Date("2026-11-16T02:00:00Z")), 1)).toEqual(["2026-11-09"]);
  });
});

describe("analisarObra", () => {
  it("PPC da semana é ponderado por atividade e turnos saem em ordem cronológica", () => {
    const r = analisarObra(
      [
        t("B", "2026-11-10", "diurno", [a(10, 10), a(10, 0, "material"), a(10, 5, "clima")]),
        t("A", "2026-11-09", "noturno", [a(5, 5)]),
      ],
      SEMANAS,
    );
    const atual = r.semanas[2];
    expect(atual).toMatchObject({ inicio: "2026-11-09", concluidas: 2, total: 4, ppc: 0.5, atual: true });
    expect(atual.turnos.map((x) => x.id)).toEqual(["A", "B"]);
    expect(atual.turnos[0].ppc).toBe(1);
    expect(atual.turnos[1].ppc).toBeCloseTo(1 / 3);
  });

  it("semana sem turno tem ppc nulo e só a última é atual", () => {
    const r = analisarObra([t("A", "2026-11-09", "diurno", [a(1, 1)])], SEMANAS);
    expect(r.semanas.map((s) => s.inicio)).toEqual(SEMANAS);
    expect(r.semanas[0]).toEqual({ inicio: "2026-10-26", concluidas: 0, total: 0, ppc: null, atual: false, turnos: [] });
    expect(r.semanas.map((s) => s.atual)).toEqual([false, false, true]);
  });

  it("variação compara a semana atual com a anterior", () => {
    const r = analisarObra(
      [
        t("A", "2026-11-03", "diurno", [a(1, 1), a(1, 1), a(1, 1), a(1, 0, "material")]),
        t("B", "2026-11-10", "diurno", [a(1, 1), a(1, 0, "clima")]),
      ],
      SEMANAS,
    );
    expect(r.variacao).toBeCloseTo(-0.25);
  });

  it("variação é nula se a semana anterior não tem turno", () => {
    const r = analisarObra([t("B", "2026-11-10", "diurno", [a(1, 1)])], SEMANAS);
    expect(r.variacao).toBeNull();
  });

  it("ignora turnos não fechados e turnos fechados sem atividades", () => {
    const r = analisarObra(
      [
        t("E", "2026-11-09", "diurno", [a(1, 0, "material")], "enviado"),
        t("C", "2026-11-10", "diurno", [a(1, 0, "material")], "em_campo"),
        t("P", "2026-11-11", "diurno", [a(1, 0, "material")], "planejado"),
        t("V", "2026-11-12", "diurno", []),
        t("F", "2026-11-13", "diurno", [a(1, 1)]),
      ],
      SEMANAS,
    );
    expect(r.semanas[2].turnos.map((x) => x.id)).toEqual(["F"]);
    expect(r.periodo).toEqual({ concluidas: 1, total: 1, ppc: 1 });
    expect(r.causas).toEqual([]);
  });

  it("ignora turnos fora do intervalo das semanas", () => {
    const r = analisarObra(
      [
        t("ANTES", "2026-10-25", "diurno", [a(1, 0, "material")]),
        t("DEPOIS", "2026-11-16", "diurno", [a(1, 0, "material")]),
        t("DENTRO", "2026-11-15", "noturno", [a(1, 1)]),
      ],
      SEMANAS,
    );
    expect(r.periodo).toEqual({ concluidas: 1, total: 1, ppc: 1 });
    expect(r.causas).toEqual([]);
  });

  it("realizado acima do planejado conta como concluída", () => {
    const r = analisarObra([t("A", "2026-11-09", "diurno", [a(10, 12)])], SEMANAS);
    expect(r.periodo).toEqual({ concluidas: 1, total: 1, ppc: 1 });
  });

  it("ranking de causas por contagem, com fração e atividades em ordem cronológica", () => {
    const r = analisarObra(
      [
        t("T2", "2026-11-10", "diurno", [a(1, 0, "material", null, "Reboco"), a(1, 1)]),
        t("T1", "2026-11-03", "noturno", [a(1, 0, "clima", null, "Pintura"), a(1, 0.5, "material", "atrasou", "Alvenaria")]),
      ],
      SEMANAS,
    );
    expect(r.causas.map(({ causa, rotulo, quantidade, fracao }) => ({ causa, rotulo, quantidade, fracao }))).toEqual([
      { causa: "material", rotulo: "Material", quantidade: 2, fracao: 2 / 3 },
      { causa: "clima", rotulo: "Clima", quantidade: 1, fracao: 1 / 3 },
    ]);
    expect(r.causas[0].atividades).toEqual([
      { turnoId: "T1", data: "2026-11-03", periodo: "noturno", descricao: "Alvenaria", observacao: "atrasou" },
      { turnoId: "T2", data: "2026-11-10", periodo: "diurno", descricao: "Reboco", observacao: null },
    ]);
  });

  it("empate no ranking mantém a ordem da primeira aparição", () => {
    const r = analisarObra(
      [t("A", "2026-11-09", "diurno", [a(1, 0, "seguranca"), a(1, 0, "equipamento")])],
      SEMANAS,
    );
    expect(r.causas.map((c) => c.causa)).toEqual(["seguranca", "equipamento"]);
  });

  it("não concluída sem causa não entra no ranking nem na fração", () => {
    const r = analisarObra([t("A", "2026-11-09", "diurno", [a(1, 0, null), a(1, 0, "clima")])], SEMANAS);
    expect(r.causas).toHaveLength(1);
    expect(r.causas[0]).toMatchObject({ causa: "clima", quantidade: 1, fracao: 1 });
  });

  it("sem turnos: período vazio e sem causas", () => {
    const r = analisarObra([], SEMANAS);
    expect(r.periodo).toEqual({ concluidas: 0, total: 0, ppc: null });
    expect(r.causas).toEqual([]);
    expect(r.variacao).toBeNull();
  });

  it("período soma todas as semanas", () => {
    const r = analisarObra(
      [t("A", "2026-10-27", "diurno", [a(1, 1)]), t("B", "2026-11-10", "diurno", [a(1, 0, "clima"), a(1, 1)])],
      SEMANAS,
    );
    expect(r.periodo.concluidas).toBe(2);
    expect(r.periodo.total).toBe(3);
    expect(r.periodo.ppc).toBeCloseTo(2 / 3);
  });
});
