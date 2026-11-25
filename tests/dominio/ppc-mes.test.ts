import { describe, expect, it } from "vitest";
import { farol, ppcPorDia } from "@/lib/dominio/ppcMes";

const at = (p: number, r: number | null) => ({ qtd_planejada: p, qtd_realizada: r });

describe("farol", () => {
  it("verde ≥ 80%, amarelo 60–79%, vermelho < 60%", () => {
    expect(farol(null)).toBeNull();
    expect(farol(0.8)).toBe("verde");
    expect(farol(0.79)).toBe("amarelo");
    expect(farol(0.6)).toBe("amarelo");
    expect(farol(0.59)).toBe("vermelho");
  });
});

describe("ppcPorDia", () => {
  it("um dia por data do intervalo, atravessando o mês; junta turnos do dia; ignora fora", () => {
    const r = ppcPorDia(
      [
        { data: "2026-10-29", atividades: [at(1, 1)] },
        { data: "2026-10-31", atividades: [at(10, 10), at(10, 5)] },
        { data: "2026-10-31", atividades: [at(4, 4)] },
        { data: "2026-11-02", atividades: [at(1, null)] },
        { data: "2026-11-03", atividades: [at(1, 1)] },
      ],
      "2026-10-30",
      "2026-11-02",
    );
    expect(r.dias.map((d) => d.data)).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(r.dias[1]).toEqual({ data: "2026-10-31", concluidas: 2, total: 3, ppc: 2 / 3 });
    expect(r.dias[0].ppc).toBeNull();
    expect(r.dias[3].ppc).toBe(0);
    expect(r.aderencia).toEqual({ concluidas: 2, total: 4, ppc: 0.5 });
  });
  it("sem turnos", () => {
    expect(ppcPorDia([], "2026-11-01", "2026-11-01").aderencia.ppc).toBeNull();
  });
});
