import { describe, expect, it } from "vitest";
import { aderencia, resumoDoTurno } from "@/lib/dominio/ritmo";

const a = (p: number, r: number | null, tipo: "extra" | null = null) => ({ qtd_planejada: p, qtd_realizada: r, tipo });
const dia = { status: "em_campo" as const, hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00" };
const sete = [a(1, 1), a(1, 1), a(1, 1), a(1, 1), a(10, 5), a(10, 5), a(3, null), a(5, 5, "extra")];

describe("resumoDoTurno", () => {
  it("conta situações, cumprimento, avanço, tempo e ritmo", () => {
    const r = resumoDoTurno(dia, sete, "13:12");
    expect(r).toMatchObject({ concluidas: 4, andamento: 2, naoIniciadas: 1, total: 7, ritmo: "no_ritmo", fechado: false });
    expect(r.cumprimento).toBeCloseTo(4 / 7);
    expect(r.avanco).toBeCloseTo(5 / 7);
    expect(r.tempo).toBeCloseTo(0.62);
  });
  it("realizado acima do planejado conta 1", () => {
    expect(resumoDoTurno(dia, [a(10, 30)], "08:00").avanco).toBe(1);
  });
  it("tempo limitado e ausente", () => {
    expect(resumoDoTurno(dia, sete, "06:00").tempo).toBe(0);
    expect(resumoDoTurno(dia, sete, "18:00").tempo).toBe(1);
    expect(resumoDoTurno(dia, sete, undefined)).toMatchObject({ tempo: null, ritmo: null });
    expect(resumoDoTurno({ ...dia, hora_inicio_prevista: null }, sete, "10:00").tempo).toBeNull();
  });
  it("noturno que vira a meia-noite", () => {
    const noite = { status: "em_campo" as const, hora_inicio_prevista: "19:00", hora_fim_prevista: "05:00" };
    expect(resumoDoTurno(noite, sete, "01:00").tempo).toBeCloseTo(0.6);
    expect(resumoDoTurno(noite, sete, "20:00").tempo).toBeCloseTo(0.1);
    expect(resumoDoTurno(noite, sete, "18:00").tempo).toBe(0);
    expect(resumoDoTurno(noite, sete, "06:00").tempo).toBe(1);
  });
  it("fechado sem tempo nem ritmo", () => {
    expect(resumoDoTurno({ ...dia, status: "fechado" }, sete, "13:00")).toMatchObject({ fechado: true, tempo: null, ritmo: null });
  });
  it("só extra", () => {
    expect(resumoDoTurno(dia, [a(1, 1, "extra")], "10:00")).toMatchObject({ total: 0, cumprimento: null, avanco: null, ritmo: null });
  });
  it("limite de 15 pontos", () => {
    const meio = [a(2, 1)];
    // 07:00–17:00: 13:24 = 0,64 ; 13:36 = 0,66
    expect(resumoDoTurno(dia, meio, "13:24").ritmo).toBe("no_ritmo");
    expect(resumoDoTurno(dia, meio, "13:36").ritmo).toBe("abaixo");
  });
});

describe("aderencia", () => {
  it("soma os turnos", () => {
    expect(aderencia([])).toEqual({ concluidas: 0, total: 0, ppc: null });
    expect(aderencia([{ atividades: [a(1, 1), a(1, 0)] }, { atividades: [a(1, 1), a(2, 2)] }])).toEqual({ concluidas: 3, total: 4, ppc: 0.75 });
  });
});
