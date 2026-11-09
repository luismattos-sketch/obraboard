import { describe, it, expect } from "vitest";
import {
  statusAtividade,
  percentualCumprimento,
  horasEntre,
  hhTurno,
  saldoPendente,
} from "@/lib/dominio/calculos";

describe("statusAtividade", () => {
  it("concluida quando realizado atinge ou supera o planejado", () => {
    expect(statusAtividade(10, 10)).toBe("concluida");
    expect(statusAtividade(10, 12)).toBe("concluida");
  });
  it("parcial quando realizado é positivo e menor que o planejado", () => {
    expect(statusAtividade(10, 4)).toBe("parcial");
  });
  it("nao_iniciada quando realizado é zero ou nulo", () => {
    expect(statusAtividade(10, 0)).toBe("nao_iniciada");
    expect(statusAtividade(10, null)).toBe("nao_iniciada");
  });
});

describe("percentualCumprimento", () => {
  it("retorna null sem atividades", () => {
    expect(percentualCumprimento([])).toBeNull();
  });
  it("é a fração de atividades concluídas", () => {
    expect(
      percentualCumprimento([
        { qtd_planejada: 10, qtd_realizada: 10 },
        { qtd_planejada: 5, qtd_realizada: 2 },
      ]),
    ).toBe(0.5);
  });
});

describe("horasEntre", () => {
  it("calcula horas no mesmo dia", () => {
    expect(horasEntre("07:00", "17:00")).toBe(10);
  });
  it("soma 24h quando fim é menor que início", () => {
    expect(horasEntre("22:00", "06:00")).toBe(8);
  });
  it("retorna null se faltar horário", () => {
    expect(horasEntre("07:30", null)).toBeNull();
  });
  it("aceita HH:MM:SS (time do Postgres), ignorando segundos", () => {
    expect(horasEntre("07:00:00", "17:00:00")).toBe(10);
    expect(horasEntre("22:00:00", "06:00:00")).toBe(8);
  });
  it("retorna null para horários fora da faixa", () => {
    expect(horasEntre("25:00", "06:00")).toBeNull();
    expect(horasEntre("07:75", "17:00")).toBeNull();
  });
});

describe("hhTurno", () => {
  it("usa o previsto quando o real não foi informado", () => {
    expect(
      hhTurno([{ quantidade: 4 }, { quantidade: 2 }], { inicio: "07:00", fim: "17:00" }, { inicio: null, fim: null }),
    ).toBe(60);
  });
  it("usa o real quando ambos os horários reais foram informados", () => {
    expect(
      hhTurno([{ quantidade: 4 }], { inicio: "07:00", fim: "17:00" }, { inicio: "07:00", fim: "16:00" }),
    ).toBe(36);
  });
  it("aceita horários HH:MM:SS", () => {
    expect(
      hhTurno([{ quantidade: 4 }], { inicio: "07:00:00", fim: "17:00:00" }, { inicio: null, fim: null }),
    ).toBe(40);
  });
  it("retorna null sem horários nem efetivo", () => {
    expect(hhTurno([], { inicio: null, fim: null }, { inicio: null, fim: null })).toBeNull();
  });
});

describe("saldoPendente", () => {
  it("é o planejado menos o realizado", () => {
    expect(saldoPendente(10, 4)).toBe(6);
  });
  it("é o planejado todo quando nada foi realizado", () => {
    expect(saldoPendente(10, null)).toBe(10);
  });
});
