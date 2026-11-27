import { describe, it, expect } from "vitest";
import type { Ocorrencia } from "@/lib/dominio/efetivoHH";
import { hhPerdidoDaObra, type TurnoHH } from "@/lib/dominio/hhPerdido";

let seq = 0;
function parada(responsavel_id: string, quantidade: number, hora_inicio: string, hora_fim: string, causa: Ocorrencia["causa"]): Ocorrencia {
  seq += 1;
  return {
    id: `o${seq}`,
    responsavel_id,
    funcao: "Montador",
    tipo: "parado",
    quantidade,
    hora_inicio,
    hora_fim,
    destino_responsavel_id: null,
    emprestimo_id: null,
    causa,
    created_at: `2026-11-16T10:00:${String(seq).padStart(2, "0")}Z`,
  };
}

function turno(id: string, ocorrencias: Ocorrencia[]): TurnoHH {
  return {
    id,
    data: "2026-11-16",
    periodo: "diurno",
    hora_inicio_prevista: "07:00",
    hora_fim_prevista: "17:00",
    hora_inicio_real: null,
    hora_fim_real: null,
    intervalo_inicio: "12:00",
    intervalo_fim: "13:00",
    efetivo: [
      { funcao: "Montador", quantidade: 6, responsavel_id: "rita" },
      { funcao: "Montador", quantidade: 4, responsavel_id: "joao" },
    ],
    ocorrencias,
    iniciados: [],
    terminados: [],
  };
}

const RESP = [
  { id: "rita", nome: "Rita" },
  { id: "joao", nome: "João" },
];

describe("hhPerdidoDaObra", () => {
  it("sem paradas: zero e listas vazias", () => {
    const r = hhPerdidoDaObra([turno("t1", [])], RESP);
    expect(r).toEqual({ total: 0, turnos: 0, grupos: [], causas: [], equipes: [] });
  });

  it("soma por causa, grupo e equipe entre turnos", () => {
    const r = hhPerdidoDaObra(
      [
        turno("t1", [parada("rita", 2, "08:00", "10:00", "material"), parada("joao", 1, "14:00", "16:00", "equipamento")]),
        turno("t2", [parada("rita", 3, "08:00", "09:00", "material")]),
        turno("t3", []),
      ],
      RESP,
    );
    expect(r.total).toBe(9);
    expect(r.turnos).toBe(2);
    expect(r.causas.map((c) => [c.causa, c.hh])).toEqual([
      ["material", 7],
      ["equipamento", 2],
    ]);
    expect(r.grupos).toEqual([
      { grupo: "externa", hh: 7, fracao: 7 / 9 },
      { grupo: "interna", hh: 2, fracao: 2 / 9 },
    ]);
    expect(r.equipes.map((e) => [e.nome, e.hh])).toEqual([
      ["Rita", 7],
      ["João", 2],
    ]);
    expect(r.equipes[1].causas[0].rotulo).toBe("Equipamento (falta ou quebra)");
  });

  it("causa 'outro' vai para o grupo Outras e equipe sem cadastro vira 'Sem equipe'", () => {
    const t = turno("t1", [parada("x", 1, "08:00", "09:00", "outro")]);
    t.efetivo.push({ funcao: "Montador", quantidade: 1, responsavel_id: "x" });
    const r = hhPerdidoDaObra([t], RESP);
    expect(r.grupos).toEqual([{ grupo: "outra", hh: 1, fracao: 1 }]);
    expect(r.equipes[0].nome).toBe("Sem equipe");
  });
});
