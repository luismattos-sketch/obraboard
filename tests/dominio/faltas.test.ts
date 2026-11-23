import { describe, expect, it } from "vitest";
import { faltasDoTurno, fimDoTurno } from "@/lib/dominio/faltas";

type Ativ = Parameters<typeof faltasDoTurno>[0]["atividades"][number];
const at = (p: Partial<Ativ> = {}): Ativ => ({
  id: "a1", descricao: "Montagem", unidade: "m", qtd_planejada: 50, qtd_realizada: null, causa: null, observacao: null,
  tipo: null, responsavel_id: "joao", ...p,
});
const turno = (p: Partial<Parameters<typeof faltasDoTurno>[0]["turno"]> = {}) => ({
  status: "em_campo" as const, data: "2026-11-23", hora_inicio_prevista: "07:00:00", hora_fim_prevista: "17:00:00",
  hora_inicio_real: null, hora_fim_real: null, ...p,
});
// 10:00 e 17:01 em São Paulo (UTC-3)
const MANHA = new Date("2026-11-23T13:00:00Z");
const DEPOIS = new Date("2026-11-23T20:01:00Z");
const base = { relatos: [], terminados: [] };

describe("fimDoTurno", () => {
  it("usa o previsto e vira o dia no noturno", () => {
    expect(fimDoTurno(turno())).toBe("2026-11-23 17:00");
    expect(fimDoTurno(turno({ hora_inicio_prevista: "19:00:00", hora_fim_prevista: "05:00:00" }))).toBe("2026-11-24 05:00");
  });
  it("real completo vence; sem horário = null", () => {
    expect(fimDoTurno(turno({ hora_inicio_real: "07:10:00", hora_fim_real: "16:30:00" }))).toBe("2026-11-23 16:30");
    expect(fimDoTurno(turno({ hora_inicio_prevista: null, hora_fim_prevista: null }))).toBeNull();
  });
});

describe("faltasDoTurno", () => {
  it("em andamento: só falta lançamento; parcial sem causa não é falta", () => {
    const g = faltasDoTurno({ ...base, turno: turno(), agora: MANHA, atividades: [at(), at({ id: "a2", qtd_realizada: 10 })] });
    expect(g).toEqual([
      { responsavelId: "joao", horaDeCobrar: false, faltas: [{ tipo: "sem_lancamento", atividadeId: "a1", texto: "Montagem — lançar quanto foi feito" }] },
    ]);
  });

  it("depois do fim: cobra causa e Terminei", () => {
    const g = faltasDoTurno({ ...base, turno: turno(), agora: DEPOIS, atividades: [at({ qtd_realizada: 10 })] });
    expect(g[0].horaDeCobrar).toBe(true);
    expect(g[0].faltas).toEqual([
      { tipo: "sem_causa", atividadeId: "a1", texto: "Montagem — informar a causa (10 de 50 m)" },
      { tipo: "terminei", atividadeId: null, texto: 'Não apertou "Terminei minha parte"' },
    ]);
  });

  it("sem lançamento na hora de cobrar mostra só o lançamento", () => {
    const g = faltasDoTurno({ ...base, turno: turno(), agora: DEPOIS, atividades: [at()] });
    expect(g[0].faltas.map((f) => f.tipo)).toEqual(["sem_lancamento", "terminei"]);
  });

  it("noturno: só cobra depois das 05:00 do dia seguinte", () => {
    const t = turno({ hora_inicio_prevista: "19:00:00", hora_fim_prevista: "05:00:00" });
    const atividades = [at({ qtd_realizada: 10 })];
    expect(faltasDoTurno({ ...base, turno: t, atividades, agora: new Date("2026-11-24T02:00:00Z") })[0].horaDeCobrar).toBe(false);
    expect(faltasDoTurno({ ...base, turno: t, atividades, agora: new Date("2026-11-24T08:00:00Z") })[0].horaDeCobrar).toBe(true);
  });

  it("equipe que terminou já está na hora de cobrar, sem falta de Terminei", () => {
    const g = faltasDoTurno({
      relatos: [], terminados: [{ responsavel_id: "joao", terminou_em: "2026-11-23T17:00:00Z" }],
      turno: turno(), agora: MANHA, atividades: [at({ qtd_realizada: 50 })],
    });
    expect(g).toEqual([{ responsavelId: "joao", horaDeCobrar: true, faltas: [] }]);
  });

  it("turno enviado: hora de cobrar, nunca Terminei", () => {
    const g = faltasDoTurno({ ...base, turno: turno({ status: "enviado" }), agora: MANHA, atividades: [at({ qtd_realizada: 50 })] });
    expect(g[0]).toEqual({ responsavelId: "joao", horaDeCobrar: true, faltas: [] });
  });

  it("extra e adiantada não viram falta de causa; extra nem de lançamento", () => {
    const g = faltasDoTurno({
      ...base, turno: turno({ status: "enviado" }), agora: DEPOIS,
      atividades: [at({ tipo: "extra" }), at({ id: "a2", tipo: "adiantada", qtd_realizada: 3 })],
    });
    expect(g[0].faltas).toEqual([]);
  });

  it("Outro sem observação na hora de cobrar é falta de causa", () => {
    const g = faltasDoTurno({ ...base, turno: turno({ status: "enviado" }), agora: DEPOIS, atividades: [at({ qtd_realizada: 10, causa: "outro" })] });
    expect(g[0].faltas.map((f) => f.tipo)).toEqual(["sem_causa"]);
  });

  it("relato não lançado conta uma vez; lançados não contam", () => {
    const atividades = [at({ qtd_realizada: 50 })];
    const um = faltasDoTurno({
      relatos: [{ responsavel_id: "joao", lancado: true }, { responsavel_id: "joao", lancado: false }],
      terminados: [], turno: turno(), agora: MANHA, atividades,
    });
    expect(um[0].faltas).toEqual([{ tipo: "relato", atividadeId: null, texto: "Texto contado à IA ainda não lançado" }]);
    const nenhum = faltasDoTurno({ relatos: [{ responsavel_id: "joao", lancado: true }], terminados: [], turno: turno(), agora: MANHA, atividades });
    expect(nenhum[0].faltas).toEqual([]);
  });

  it("sem responsável: grupo null, sem Terminei; ordem da 1ª atividade", () => {
    const g = faltasDoTurno({
      ...base, turno: turno(), agora: DEPOIS,
      atividades: [at({ id: "a1", responsavel_id: null, qtd_realizada: 50 }), at({ id: "a2", responsavel_id: "ana", qtd_realizada: 50 })],
    });
    expect(g.map((x) => x.responsavelId)).toEqual([null, "ana"]);
    expect(g[0].faltas).toEqual([]);
    expect(g[1].faltas.map((f) => f.tipo)).toEqual(["terminei"]);
  });

  it("planejado e fechado não têm faltas; sem horário só cobra por Terminei/enviado", () => {
    expect(faltasDoTurno({ ...base, turno: turno({ status: "planejado" }), agora: DEPOIS, atividades: [at()] })).toEqual([]);
    expect(faltasDoTurno({ ...base, turno: turno({ status: "fechado" }), agora: DEPOIS, atividades: [at()] })).toEqual([]);
    const sem = turno({ hora_inicio_prevista: null, hora_fim_prevista: null });
    expect(faltasDoTurno({ ...base, turno: sem, agora: DEPOIS, atividades: [at()] })[0].horaDeCobrar).toBe(false);
  });
});
