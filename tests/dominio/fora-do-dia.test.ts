import { describe, expect, it } from "vitest";
import { autorDoLancamento, copiasParaAjustar, opcoesParaPuxar, podeRemoverPlanejador, seloDaAtividade, validarExtra } from "@/lib/dominio/foraDoDia";
import type { AtividadeProgramada, DadosSemana, ExecucaoLigada, TurnoDaSemana } from "@/lib/dominio/programacao";

// Semana seg 16/11; hoje = qua 18/11 (dia 2), diurno.
const INICIO = "2026-11-16";
const HOJE = { id: "tq", data: "2026-11-18", periodo: "diurno" as const };

const ativ = (p: Partial<AtividadeProgramada> = {}): AtividadeProgramada => ({
  id: "p1", ordem: 0, descricao: "Pintura", local: null, unidade: "m²", meta: 80, responsavel_id: "rita",
  dias: [3, 4], periodo: "diurno", causa: null, equipe: [], ...p,
});
const exec = (p: Partial<ExecucaoLigada> = {}): ExecucaoLigada => ({
  id: "x1", programacao_atividade_id: "p1", turno_id: "tseg", data: "2026-11-16", periodo: "diurno",
  status_turno: "fechado", qtd_planejada: 5, qtd_realizada: null, causa: null, ...p,
});
const turno = (p: Partial<TurnoDaSemana> = {}): TurnoDaSemana => ({
  id: "tqi", data: "2026-11-19", periodo: "diurno", status: "planejado",
  hora_inicio_prevista: "07:00:00", hora_fim_prevista: "17:00:00", hora_inicio_real: null, hora_fim_real: null,
  efetivo: [], extras: [], ...p,
});
const dados = (p: Partial<DadosSemana> = {}): DadosSemana => ({
  semana: { id: "s1", obra_id: "o1", inicio: INICIO, status: "programada", programada_em: null, encerrada_em: null, motivo_reabertura: null },
  atividades: [], execucoes: [], turnos: [], ...p,
});

describe("opcoesParaPuxar", () => {
  it("adiantar só futuras dele", () => {
    const d = dados({ atividades: [ativ()] });
    expect(opcoesParaPuxar(d, HOJE, "rita")).toEqual({
      adiantar: [{ programacaoAtividadeId: "p1", descricao: "Pintura", unidade: "m²", dias: [3, 4], saldo: 80, responsavel_id: "rita" }],
      atrasadas: [],
    });
    expect(opcoesParaPuxar(d, HOJE, "carlos")).toEqual({ adiantar: [], atrasadas: [] });
  });

  it("escopo null (planejador) vê de todos", () => {
    const d = dados({ atividades: [ativ(), ativ({ id: "p2", responsavel_id: "carlos" })] });
    expect(opcoesParaPuxar(d, HOJE, null).adiantar.map((o) => o.programacaoAtividadeId)).toEqual(["p1", "p2"]);
  });

  it("atrasada vai para atrasadas", () => {
    const d = dados({ atividades: [ativ({ dias: [0, 1], meta: 10 })], execucoes: [exec({ qtd_realizada: 4 })] });
    const r = opcoesParaPuxar(d, HOJE, "rita");
    expect(r.adiantar).toEqual([]);
    expect(r.atrasadas.map((o) => o.saldo)).toEqual([6]);
  });

  it("com hoje e passado é atrasada", () => {
    const r = opcoesParaPuxar(dados({ atividades: [ativ({ dias: [1, 2] })] }), HOJE, "rita");
    expect(r.atrasadas).toHaveLength(1);
    expect(r.adiantar).toEqual([]);
  });

  it("só hoje (ou hoje e futuro) não aparece", () => {
    expect(opcoesParaPuxar(dados({ atividades: [ativ({ dias: [2] })] }), HOJE, "rita")).toEqual({ adiantar: [], atrasadas: [] });
    expect(opcoesParaPuxar(dados({ atividades: [ativ({ dias: [2, 3] })] }), HOJE, "rita")).toEqual({ adiantar: [], atrasadas: [] });
  });

  it("já no turno some", () => {
    const d = dados({ atividades: [ativ()], execucoes: [exec({ turno_id: "tq", data: "2026-11-18" })] });
    expect(opcoesParaPuxar(d, HOJE, "rita").adiantar).toEqual([]);
  });

  it("saldo conta turnos de qualquer status; zero some", () => {
    const d = dados({ atividades: [ativ()], execucoes: [exec({ turno_id: "tx", status_turno: "em_campo", qtd_realizada: 80 })] });
    expect(opcoesParaPuxar(d, HOJE, "rita").adiantar).toEqual([]);
    const d2 = dados({ atividades: [ativ()], execucoes: [exec({ turno_id: "tx", status_turno: "em_campo", qtd_realizada: 30.5 })] });
    expect(opcoesParaPuxar(d2, HOJE, "rita").adiantar[0].saldo).toBe(49.5);
  });

  it("outro período some", () => {
    expect(opcoesParaPuxar(dados({ atividades: [ativ({ periodo: "noturno" })] }), HOJE, "rita").adiantar).toEqual([]);
  });

  it("semana rascunho ou turno fora da semana → vazio", () => {
    const rasc = dados({ atividades: [ativ()] });
    rasc.semana = { ...rasc.semana, status: "rascunho" };
    expect(opcoesParaPuxar(rasc, HOJE, "rita")).toEqual({ adiantar: [], atrasadas: [] });
    expect(opcoesParaPuxar(dados({ atividades: [ativ()] }), { ...HOJE, data: "2026-11-25" }, "rita")).toEqual({ adiantar: [], atrasadas: [] });
  });
});

describe("copiasParaAjustar", () => {
  const adiantadaQua = (real: number) => exec({ id: "xq", turno_id: "tq", data: "2026-11-18", status_turno: "em_campo", qtd_planejada: 80, qtd_realizada: real, tipo: "adiantada" });
  const copiaQui = exec({ id: "xqi", turno_id: "tqi", data: "2026-11-19", status_turno: "planejado", qtd_planejada: 40, qtd_realizada: null, tipo: null });

  it("recalcula a cópia de quinta pelo novo saldo", () => {
    const d = dados({ atividades: [ativ()], execucoes: [adiantadaQua(50), copiaQui], turnos: [turno()] });
    expect(copiasParaAjustar(d, "p1", "2026-11-18")).toEqual([{ turnoId: "tqi", atividadeId: "xqi", nova: 30 }]);
  });

  it("sem saldo: cópia removida (nova null)", () => {
    const d = dados({ atividades: [ativ()], execucoes: [adiantadaQua(80), copiaQui], turnos: [turno()] });
    expect(copiasParaAjustar(d, "p1", "2026-11-18")).toEqual([{ turnoId: "tqi", atividadeId: "xqi", nova: null }]);
  });

  it("turno já em campo ou cópia com execução não é tocado", () => {
    const emCampo = dados({ atividades: [ativ()], execucoes: [adiantadaQua(50), { ...copiaQui, status_turno: "em_campo" }], turnos: [turno({ status: "em_campo" })] });
    expect(copiasParaAjustar(emCampo, "p1", "2026-11-18")).toEqual([]);
    const comExec = dados({ atividades: [ativ()], execucoes: [adiantadaQua(50), { ...copiaQui, qtd_realizada: 1 }], turnos: [turno()] });
    expect(copiasParaAjustar(comExec, "p1", "2026-11-18")).toEqual([]);
  });
});

describe("validarExtra", () => {
  it("valida e devolve a equipe", () => {
    const base = { id: "4f1c2b3a-1111-4222-8333-444455556666", descricao: "Extra", unidade: "un", qtd: 1 };
    expect(validarExtra({ ...base, equipe: [{ funcao: "", quantidade: 1 }] })).toMatchObject({ ok: false, erro: "Informe a função de cada linha da equipe" });
    expect(validarExtra({ ...base, equipe: [{ funcao: "Soldador", quantidade: 2 }] })).toMatchObject({ ok: true, dados: { equipe: [{ funcao: "Soldador", quantidade: 2 }] } });
  });
  const ok = { id: "6f1c2a52-9a0b-4c55-8a39-1f2b3c4d5e6f", descricao: "  Troca de iluminação ", unidade: " un ", qtd: 12, observacao: " ", responsavel_id: null };
  it("aceita e apara", () => {
    expect(validarExtra(ok)).toEqual({ ok: true, dados: { ...ok, descricao: "Troca de iluminação", unidade: "un", observacao: null, equipe: [] } });
  });
  it("recusa quantidade zero, descrição vazia e id inválido", () => {
    expect(validarExtra({ ...ok, qtd: 0 }).ok).toBe(false);
    expect(validarExtra({ ...ok, descricao: " " }).ok).toBe(false);
    expect(validarExtra({ ...ok, unidade: "" }).ok).toBe(false);
    expect(validarExtra({ ...ok, id: "x" }).ok).toBe(false);
    expect(validarExtra({ ...ok, observacao: "a".repeat(501) }).ok).toBe(false);
  });
});

describe("textos do planejador", () => {
  const nome = (id: string | null) => ({ c: "Carlos Pereira" })[id ?? ""] ?? "Responsável removido";
  it("autorDoLancamento", () => {
    expect(autorDoLancamento({ criada_por_id: "c" }, nome, null)).toBe("lançado pelo campo — Carlos Pereira");
    expect(autorDoLancamento({ criada_por_id: "c" }, nome, "c")).toBe("lançado por você");
    expect(autorDoLancamento({ criada_por_id: null }, nome, null)).toBeNull();
  });
  it("seloDaAtividade", () => {
    expect(seloDaAtividade({ tipo: "extra", programacao_atividade_id: null }, "programada")).toEqual({ texto: "Extra", tom: "alerta" });
    expect(seloDaAtividade({ tipo: "adiantada", programacao_atividade_id: "p" }, "programada")).toEqual({ texto: "Adiantada", tom: "info" });
    expect(seloDaAtividade({ tipo: null, programacao_atividade_id: "p" }, "programada")).toEqual({ texto: "Programada", tom: "info" });
    expect(seloDaAtividade({ tipo: null, programacao_atividade_id: null }, "programada")).toEqual({ texto: "Avulsa", tom: "neutro" });
    expect(seloDaAtividade({ tipo: null, programacao_atividade_id: null }, null)).toBeNull();
  });
  it("podeRemoverPlanejador", () => {
    expect(podeRemoverPlanejador({ tipo: "extra", criada_por_id: null })).toBe(true);
    expect(podeRemoverPlanejador({ tipo: null, criada_por_id: "c" })).toBe(true);
    expect(podeRemoverPlanejador({ tipo: null, criada_por_id: null })).toBe(false);
    expect(podeRemoverPlanejador({ tipo: null, criada_por_id: null, puxada: true })).toBe(true);
  });
});
