import { describe, it, expect } from "vitest";
import { resumirTurno } from "@/lib/dominio/resumo";
import { formatarData, formatarPercentual } from "@/lib/dominio/formato";
import type { Causa } from "@/lib/dominio/tipos";
import type { TurnoCompleto } from "@/lib/db/turnos";

const at = (id: string, p: number, r: number | null, causa: Causa | null = null, ordem = 0) =>
  ({ id, turno_id: "t", ordem, descricao: `A${id}`, local: null, unidade: "m", qtd_planejada: p, qtd_realizada: r, causa, observacao: null, origem_id: null, programacao_atividade_id: null, responsavel_id: null, lancado_por_id: null });

function turno(over: Partial<TurnoCompleto> = {}): TurnoCompleto {
  return {
    id: "t", obra_id: "o", data: "2026-11-08", periodo: "diurno",
    hora_inicio_prevista: "07:00:00", hora_fim_prevista: "17:00:00", hora_inicio_real: null, hora_fim_real: null,
    status: "enviado", token_hash: null, enviado_em: null, fechado_em: null,
    obra: { id: "o", empresa_id: "e", nome: "Obra", cliente: null, endereco: null, created_at: "" },
    atividades: [at("1", 10, 10), at("2", 10, 4, "material"), at("3", 5, null, "material"), at("4", 2, 0, "clima")],
    efetivo: [{ id: "e1", turno_id: "t", funcao: "Pedreiro", quantidade: 4 }, { id: "e2", turno_id: "t", funcao: "Servente", quantidade: 2 }],
    clima: [{ turno_id: "t", periodo: "tarde", condicao: "chuva_forte", impediu: true }],
    ...over,
  } as unknown as TurnoCompleto;
}

describe("resumirTurno", () => {
  it("calcula cumprimento, HH, efetivo, restrições e clima", () => {
    const r = resumirTurno(turno());
    expect(r.cumprimento).toBe(0.25);
    expect(r.hh).toBe(60);
    expect(r.efetivoTotal).toBe(6);
    expect(r.restricoesPorCausa[0].causa).toBe("material");
    expect(r.restricoesPorCausa[0].atividades).toHaveLength(2);
    expect(r.restricoesPorCausa[1].causa).toBe("clima");
    expect(r.climaImpediu).toBe(true);
    expect(r.atividades.map((a) => a.status)).toEqual(["concluida", "parcial", "nao_iniciada", "nao_iniciada"]);
  });
  it("efetivo com empréstimo e parado: conta cada pessoa uma vez e separa HH parado", () => {
    const r = resumirTurno(turno({
      intervalo_inicio: "12:00:00", intervalo_fim: "13:00:00",
      efetivo: [
        { id: "e1", turno_id: "t", funcao: "Montador", quantidade: 6, responsavel_id: "rita" },
        { id: "e2", turno_id: "t", funcao: "Caldeireiro", quantidade: 5, responsavel_id: "ana" },
      ],
      ocorrencias: [
        { id: "o1", responsavel_id: "rita", funcao: "Montador", tipo: "emprestimo", quantidade: 2, hora_inicio: "13:00:00", hora_fim: null,
          destino_responsavel_id: "ana", emprestimo_id: null, causa: null, created_at: "1" },
        { id: "o2", responsavel_id: "rita", funcao: "Montador", tipo: "parado", quantidade: 2, hora_inicio: "08:00:00", hora_fim: "10:00:00",
          destino_responsavel_id: null, emprestimo_id: null, causa: "material", created_at: "2" },
      ],
    }));
    expect(r.efetivoTotal).toBe(11);
    expect(r.hh).toBe(99);
    expect(r.hhParado).toBe(4);
    expect(r.hhParadoPorCausa).toEqual({ material: 4 });
    expect(r.avisosEfetivo).toEqual([]);
    expect(r.hhEquipes.find((e) => e.responsavel_id === "ana")?.hhProdutivo).toBe(53);
  });
  it("turno vazio", () => {
    const r = resumirTurno(turno({ atividades: [], efetivo: [], clima: [] }));
    expect(r).toMatchObject({ cumprimento: null, hh: null, efetivoTotal: 0, restricoesPorCausa: [], climaImpediu: false });
  });
  it("ignora causa em atividade concluída", () => {
    const r = resumirTurno(turno({ atividades: [at("1", 10, 10, "material")] }));
    expect(r.restricoesPorCausa).toEqual([]);
  });
});

describe("formatação", () => {
  it("percentual e data", () => {
    expect(formatarPercentual(0.25)).toBe("25%");
    expect(formatarPercentual(null)).toBe("—");
    expect(formatarData("2026-11-08")).toBe("08/11/2026");
  });
});
