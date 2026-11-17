import { describe, it, expect } from "vitest";
import {
  calcularHH,
  descreverOcorrencia,
  janelaDoTurno,
  type EntradaHH,
  type Ocorrencia,
} from "@/lib/dominio/efetivoHH";

const RITA = "rita";
const ANA = "ana";
const DIA = { inicio: "07:00", fim: "17:00" };
const ALMOCO = { inicio: "12:00", fim: "13:00" };

let seq = 0;
function oc(p: Partial<Ocorrencia> & Pick<Ocorrencia, "tipo" | "quantidade" | "hora_inicio">): Ocorrencia {
  seq += 1;
  return {
    id: `o${seq}`,
    responsavel_id: RITA,
    funcao: "Montador de andaime",
    hora_fim: null,
    destino_responsavel_id: null,
    emprestimo_id: null,
    causa: null,
    created_at: `2026-11-16T10:00:${String(seq).padStart(2, "0")}Z`,
    ...p,
  };
}

const rita6 = { funcao: "Montador de andaime", quantidade: 6, responsavel_id: RITA };
const ana5 = { funcao: "Caldeireiro", quantidade: 5, responsavel_id: ANA };

function entrada(p: Partial<EntradaHH>): EntradaHH {
  return { efetivo: [rita6], ocorrencias: [], janela: DIA, intervalo: ALMOCO, ...p };
}
const equipe = (r: ReturnType<typeof calcularHH>, id: string | null) => r.equipes.find((e) => e.responsavel_id === id)!;

describe("calcularHH", () => {
  it("sem ocorrências: 6 pessoas → 54 HH (desconta 1 h de almoço)", () => {
    const r = calcularHH(entrada({}));
    expect(equipe(r, RITA)).toMatchObject({ pessoas: 6, hhProdutivo: 54, hhParado: 0 });
    expect(r.hh).toBe(54);
  });

  it("intervalo null mantém a conta antiga", () => {
    expect(calcularHH(entrada({ intervalo: null })).hh).toBe(60);
  });

  it("Rita empresta 2 para Ana a partir de 13:00", () => {
    const emp = oc({ tipo: "emprestimo", quantidade: 2, hora_inicio: "13:00", destino_responsavel_id: ANA });
    const r = calcularHH(entrada({ efetivo: [rita6, ana5], ocorrencias: [emp] }));
    expect(r.pessoas).toBe(11);
    expect(equipe(r, RITA).hhProdutivo).toBe(46);
    expect(equipe(r, ANA).hhProdutivo).toBe(53);
    expect(equipe(r, ANA).pessoas).toBe(5);
    expect(equipe(r, ANA).recebidos[0]).toEqual({
      emprestimo_id: emp.id, de: RITA, funcao: "Montador de andaime", quantidade: 2, inicio: "13:00", fim: "17:00",
    });
    expect(r.hh).toBe(99);
  });

  it("empréstimo com volta: 08:00 até 12:00", () => {
    const emp = oc({ tipo: "emprestimo", quantidade: 2, hora_inicio: "08:00", hora_fim: "12:00", destino_responsavel_id: ANA });
    const r = calcularHH(entrada({ efetivo: [rita6, ana5], ocorrencias: [emp] }));
    expect(equipe(r, ANA).hhProdutivo).toBe(45 + 8);
    expect(equipe(r, RITA).hhProdutivo).toBe(46);
  });

  it("equipe que só recebeu empréstimo aparece", () => {
    const emp = oc({ tipo: "emprestimo", quantidade: 2, hora_inicio: "13:00", destino_responsavel_id: ANA });
    const r = calcularHH(entrada({ ocorrencias: [emp] }));
    expect(equipe(r, ANA)).toMatchObject({ pessoas: 0, hhProdutivo: 8 });
    expect(r.pessoas).toBe(6);
  });

  it("saída antes do almoço não desconta intervalo", () => {
    const r = calcularHH(entrada({ ocorrencias: [oc({ tipo: "saida", quantidade: 2, hora_inicio: "12:00" })] }));
    expect(equipe(r, RITA).hhProdutivo).toBe(4 * 9 + 2 * 5);
  });

  it("parado atravessando o almoço", () => {
    const r = calcularHH(
      entrada({ ocorrencias: [oc({ tipo: "parado", quantidade: 2, hora_inicio: "11:00", hora_fim: "14:00", causa: "material" })] }),
    );
    const e = equipe(r, RITA);
    expect(e.hhParado).toBe(4);
    expect(e.hhParadoPorCausa.material).toBe(4);
    expect(e.hhProdutivo).toBe(50);
    expect(r.hh).toBe(54);
    expect(r.hhParado).toBe(4);
  });

  it("parado registrado pelo destino sobre o empréstimo", () => {
    const emp = oc({ tipo: "emprestimo", quantidade: 2, hora_inicio: "13:00", destino_responsavel_id: ANA });
    const par = oc({
      tipo: "parado", quantidade: 2, hora_inicio: "15:00", hora_fim: "16:00", causa: "equipamento",
      responsavel_id: ANA, emprestimo_id: emp.id,
    });
    const r = calcularHH(entrada({ efetivo: [rita6, ana5], ocorrencias: [emp, par] }));
    expect(equipe(r, ANA).hhParado).toBe(2);
    expect(equipe(r, RITA).hhParado).toBe(0);
  });

  it("saída registrada pelo destino encerra os emprestados", () => {
    const emp = oc({ tipo: "emprestimo", quantidade: 2, hora_inicio: "13:00", destino_responsavel_id: ANA });
    const sai = oc({ tipo: "saida", quantidade: 1, hora_inicio: "15:00", responsavel_id: ANA, emprestimo_id: emp.id });
    const r = calcularHH(entrada({ efetivo: [rita6, ana5], ocorrencias: [emp, sai] }));
    expect(equipe(r, ANA).hhProdutivo).toBe(45 + 4 + 2);
  });

  it("incoerência: linha 1, empréstimo 2", () => {
    const r = calcularHH(
      entrada({
        efetivo: [{ ...rita6, quantidade: 1 }],
        ocorrencias: [oc({ tipo: "emprestimo", quantidade: 2, hora_inicio: "13:00", destino_responsavel_id: ANA })],
      }),
    );
    expect(equipe(r, ANA).hhProdutivo).toBe(4);
    expect(r.avisos).toHaveLength(1);
    expect(r.avisos[0]).toContain("2 emprestados");
    expect(equipe(r, RITA).avisos).toHaveLength(1);
  });

  it("ordem de corte por created_at", () => {
    const r = calcularHH(
      entrada({
        efetivo: [{ ...rita6, quantidade: 2 }],
        ocorrencias: [
          oc({ tipo: "emprestimo", quantidade: 2, hora_inicio: "13:00", destino_responsavel_id: ANA, created_at: "2026-11-16T11:00:00Z" }),
          oc({ tipo: "saida", quantidade: 2, hora_inicio: "15:00", created_at: "2026-11-16T10:00:00Z" }),
        ],
      }),
    );
    expect(equipe(r, RITA).hhProdutivo).toBe(14);
    expect(r.avisos).toHaveLength(1);
  });

  it("saída na origem depois de voltar do empréstimo", () => {
    const r = calcularHH(entrada({
      efetivo: [{ ...rita6, quantidade: 1 }],
      ocorrencias: [
        oc({ tipo: "emprestimo", quantidade: 1, hora_inicio: "08:00", hora_fim: "10:00", destino_responsavel_id: ANA }),
        oc({ tipo: "saida", quantidade: 1, hora_inicio: "15:00" }),
      ],
    }));
    expect(equipe(r, RITA).hhProdutivo).toBe(5);
    expect(equipe(r, ANA).hhProdutivo).toBe(2);
    expect(r.avisos).toEqual([]);
  });

  it("parado registrado depois do empréstimo vale para quem está na origem", () => {
    const r = calcularHH(entrada({
      efetivo: [{ ...rita6, quantidade: 2 }],
      ocorrencias: [
        oc({ tipo: "emprestimo", quantidade: 2, hora_inicio: "13:00", destino_responsavel_id: ANA }),
        oc({ tipo: "parado", quantidade: 2, hora_inicio: "08:00", hora_fim: "10:00", causa: "material" }),
      ],
    }));
    expect(equipe(r, RITA).hhParado).toBe(4);
    expect(r.avisos).toEqual([]);
  });

  it("parado seguido de empréstimo não leva HH parado para o destino", () => {
    const r = calcularHH(entrada({
      efetivo: [{ ...rita6, quantidade: 2 }],
      ocorrencias: [
        oc({ tipo: "parado", quantidade: 2, hora_inicio: "08:00", hora_fim: "10:00", causa: "material" }),
        oc({ tipo: "emprestimo", quantidade: 2, hora_inicio: "09:00", destino_responsavel_id: ANA }),
      ],
    }));
    expect(equipe(r, ANA).hhParado).toBe(0);
    expect(equipe(r, RITA).hhParado).toBe(2);
  });

  it("noturno atravessa meia-noite", () => {
    const r = calcularHH({
      efetivo: [{ funcao: "Soldador", quantidade: 4, responsavel_id: "a" }],
      ocorrencias: [oc({ responsavel_id: "a", funcao: "Soldador", tipo: "emprestimo", quantidade: 2, hora_inicio: "02:00", destino_responsavel_id: "b" })],
      janela: { inicio: "22:00", fim: "06:00" },
      intervalo: { inicio: "00:00", fim: "01:00" },
    });
    expect(equipe(r, "a").hhProdutivo).toBe(20);
    expect(equipe(r, "b").hhProdutivo).toBe(8);
  });

  it("função casa sem acento e caixa", () => {
    const r = calcularHH(entrada({ ocorrencias: [oc({ funcao: "montador DE andaime ", tipo: "saida", quantidade: 6, hora_inicio: "12:00" })] }));
    expect(r.hh).toBe(30);
  });

  it("sem janela → HH null, pessoas contadas", () => {
    const r = calcularHH(entrada({ janela: null }));
    expect(r.pessoas).toBe(6);
    expect(r.hh).toBeNull();
    expect(r.hhParado).toBeNull();
    expect(equipe(r, RITA).hhProdutivo).toBeNull();
  });

  it("sem pessoas → HH null", () => {
    expect(calcularHH(entrada({ efetivo: [] })).hh).toBeNull();
  });
});

describe("janelaDoTurno", () => {
  const base = { hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00", hora_inicio_real: null, hora_fim_real: null };
  it("real completa vence", () => {
    expect(janelaDoTurno({ ...base, hora_inicio_real: "07:30", hora_fim_real: "16:00" })).toEqual({ inicio: "07:30", fim: "16:00" });
  });
  it("real incompleta usa prevista", () => {
    expect(janelaDoTurno({ ...base, hora_inicio_real: "07:30" })).toEqual({ inicio: "07:00", fim: "17:00" });
  });
  it("nada → null", () => {
    expect(janelaDoTurno({ ...base, hora_inicio_prevista: null })).toBeNull();
  });
});

describe("descreverOcorrencia", () => {
  const nome = (id: string | null) => (id === ANA ? "Ana" : "Rita");
  it("empréstimo", () => {
    expect(descreverOcorrencia(oc({ tipo: "emprestimo", quantidade: 2, hora_inicio: "13:00", destino_responsavel_id: ANA }), nome)).toBe(
      "2 Montador de andaime emprestados → Ana a partir de 13:00",
    );
  });
  it("empréstimo com volta", () => {
    expect(
      descreverOcorrencia(oc({ tipo: "emprestimo", quantidade: 2, hora_inicio: "08:00", hora_fim: "12:00", destino_responsavel_id: ANA }), nome),
    ).toBe("2 Montador de andaime emprestados → Ana de 08:00 até 12:00");
  });
  it("saída", () => {
    expect(descreverOcorrencia(oc({ tipo: "saida", quantidade: 2, hora_inicio: "12:00" }), nome)).toBe("2 saíram às 12:00");
  });
  it("parados", () => {
    expect(
      descreverOcorrencia(oc({ tipo: "parado", quantidade: 2, hora_inicio: "08:00", hora_fim: "10:00", causa: "material" }), nome),
    ).toBe("2 parados 08:00–10:00 · Falta material");
  });
  it("horário do banco com segundos sai sem segundos", () => {
    expect(descreverOcorrencia(oc({ tipo: "saida", quantidade: 1, hora_inicio: "12:00:00" }), nome)).toBe("1 saiu às 12:00");
  });
});
