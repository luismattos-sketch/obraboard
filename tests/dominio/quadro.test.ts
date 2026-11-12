import { describe, expect, it } from "vitest";
import {
  contarSemResponsavel,
  escolherTurno,
  montarQuadro,
  resolverEscolhaCampo,
  resumoEquipe,
  textoSemResponsavel,
  visaoPadrao,
  visaoValida,
  vizinhos,
  type EntradaQuadro,
  type TurnoRef,
} from "@/lib/dominio/quadro";

type At = EntradaQuadro["atividades"][number];
let seq = 0;
const at = (resp: string | null, plan: number, real: number | null, extra: Partial<At> = {}): At => ({
  id: `a${++seq}`,
  ordem: seq,
  descricao: `Atividade ${seq}`,
  local: null,
  unidade: "un",
  qtd_planejada: plan,
  qtd_realizada: real,
  causa: null,
  programada: true,
  responsavel_id: resp,
  ...extra,
});
const TURNO: EntradaQuadro["turno"] = {
  id: "t1", data: "2026-11-11", periodo: "diurno", status: "em_campo",
  hora_inicio_prevista: "07:00", hora_fim_prevista: "15:48", hora_inicio_real: null, hora_fim_real: null,
};
const entrada = (p: Partial<EntradaQuadro>): EntradaQuadro => ({
  obra: { id: "o1", nome: "Obra" },
  turno: TURNO,
  responsaveis: [
    { id: "j", nome: "João", ativo: true },
    { id: "a", nome: "Ana", ativo: false },
  ],
  atividades: [],
  efetivo: [],
  ...p,
});

describe("montarQuadro", () => {
  it("faixas em ordem alfabética e 'Sem responsável' por último", () => {
    const m = montarQuadro(entrada({ atividades: [at(null, 1, null), at("j", 1, null), at("a", 1, null)] }));
    expect(m.faixas.map((f) => f.responsavel?.nome ?? null)).toEqual(["Ana", "João", null]);
    expect(m.faixas[0].responsavel?.ativo).toBe(false);
  });

  it("sem faixa 'Sem responsável' quando tudo tem responsável", () => {
    const m = montarQuadro(entrada({ atividades: [at("j", 1, null)] }));
    expect(m.faixas.map((f) => f.responsavel?.id ?? null)).toEqual(["j"]);
  });

  it("atividades em ordem e com situação", () => {
    const x = at("j", 4, 4, { ordem: 9 });
    const y = at("j", 4, 2, { ordem: 1 });
    const m = montarQuadro(entrada({ atividades: [x, y] }));
    expect(m.faixas[0].atividades.map((a) => [a.id, a.situacao])).toEqual([[y.id, "parcial"], [x.id, "concluida"]]);
  });

  it("efetivo de responsável sem atividades gera faixa própria", () => {
    const m = montarQuadro(entrada({ atividades: [at("j", 1, null)], efetivo: [{ funcao: "Pedreiro", quantidade: 2, responsavel_id: "a" }] }));
    const ana = m.faixas.find((f) => f.responsavel?.id === "a")!;
    expect(ana.atividades).toEqual([]);
    expect(ana.efetivo).toEqual([{ funcao: "Pedreiro", quantidade: 2 }]);
  });
});

describe("resumoEquipe", () => {
  it("programadas no percentual e extras à parte", () => {
    const m = montarQuadro(entrada({
      atividades: [at("j", 2, 1), at("j", 2, null), at("j", 1, 1, { programada: false })],
      efetivo: [{ funcao: "Mecânico", quantidade: 2, responsavel_id: "j" }, { funcao: "Soldador", quantidade: 1, responsavel_id: "j" }],
    }));
    expect(m.faixas[0].resumo).toEqual({ concluidas: 0, total: 2, percentual: 0, extras: 1, base: "programadas", pessoas: 3, hh: 26.4 });
  });

  it("turno sem nenhuma programada usa todas", () => {
    const m = montarQuadro(entrada({ atividades: [at("j", 1, 1, { programada: false }), at("j", 1, 0, { programada: false })] }));
    expect(m.faixas[0].resumo).toMatchObject({ concluidas: 1, total: 2, percentual: 0.5, extras: 0, base: "todas" });
  });

  it("faixa sem atividades tem percentual null e sem efetivo hh null", () => {
    const r = resumoEquipe({ atividades: [], efetivo: [] }, TURNO, true);
    expect(r).toMatchObject({ total: 0, percentual: null, pessoas: 0, hh: null });
  });
});

const tr = (id: string, data: string, periodo: "diurno" | "noturno", status: TurnoRef["status"] = "planejado"): TurnoRef => ({ id, data, periodo, status });

describe("escolherTurno", () => {
  const HOJE = "2026-11-11";
  it("diurno aberto antes do noturno", () => {
    expect(escolherTurno([tr("n", HOJE, "noturno"), tr("d", HOJE, "diurno")], HOJE)).toEqual({ turno: tr("d", HOJE, "diurno"), foraDeHoje: false });
  });
  it("diurno fechado passa para o noturno", () => {
    expect(escolherTurno([tr("d", HOJE, "diurno", "fechado"), tr("n", HOJE, "noturno")], HOJE).turno?.id).toBe("n");
  });
  it("só noturno", () => {
    expect(escolherTurno([tr("n", HOJE, "noturno")], HOJE).turno?.id).toBe("n");
  });
  it("diurno fechado sem noturno", () => {
    expect(escolherTurno([tr("x", "2026-11-10", "noturno"), tr("d", HOJE, "diurno", "fechado")], HOJE)).toEqual({
      turno: tr("d", HOJE, "diurno", "fechado"),
      foraDeHoje: false,
    });
  });
  it("sem turno hoje mostra o último", () => {
    const r = escolherTurno([tr("a", "2026-11-09", "noturno"), tr("b", "2026-11-10", "diurno"), tr("c", "2026-11-10", "noturno")], HOJE);
    expect(r).toEqual({ turno: tr("c", "2026-11-10", "noturno"), foraDeHoje: true });
  });
  it("lista vazia", () => {
    expect(escolherTurno([], HOJE)).toEqual({ turno: null, foraDeHoje: false });
  });
});

describe("vizinhos", () => {
  const lista = [tr("c", "2026-11-10", "noturno"), tr("a", "2026-11-09", "diurno"), tr("b", "2026-11-10", "diurno")];
  it("ordem cronológica", () => {
    expect(vizinhos(lista, "b")).toEqual({ anterior: "a", seguinte: "c" });
  });
  it("bordas e desconhecido", () => {
    expect(vizinhos(lista, "a")).toEqual({ anterior: null, seguinte: "b" });
    expect(vizinhos(lista, "c")).toEqual({ anterior: "b", seguinte: null });
    expect(vizinhos(lista, "zz")).toEqual({ anterior: null, seguinte: null });
  });
});

describe("visão", () => {
  it("padrão pela situação", () => {
    expect(visaoPadrao("planejado")).toBe("checkin");
    expect(visaoPadrao("em_campo")).toBe("checkout");
    expect(visaoPadrao("enviado")).toBe("checkout");
    expect(visaoPadrao("fechado")).toBe("checkout");
  });
  it("valida a pedida", () => {
    expect(visaoValida("checkout", "planejado")).toBe("checkin");
    expect(visaoValida("xyz", "fechado")).toBe("checkout");
    expect(visaoValida("checkin", "fechado")).toBe("checkin");
  });
});

describe("resolverEscolhaCampo", () => {
  const ids = ["11111111-1111-1111-1111-111111111111"];
  it("casos", () => {
    expect(resolverEscolhaCampo(undefined, ids)).toEqual({ modo: "escolher" });
    expect(resolverEscolhaCampo("todos", ids)).toEqual({ modo: "todos" });
    expect(resolverEscolhaCampo(ids[0], ids)).toEqual({ modo: "responsavel", id: ids[0] });
    expect(resolverEscolhaCampo("22222222-2222-2222-2222-222222222222", ids)).toEqual({ modo: "escolher" });
    expect(resolverEscolhaCampo(["x"], ids)).toEqual({ modo: "escolher" });
    expect(resolverEscolhaCampo(undefined, [])).toEqual({ modo: "todos" });
  });
});

describe("sem responsável", () => {
  it("conta e descreve", () => {
    expect(contarSemResponsavel([{ responsavel_id: null }, { responsavel_id: "x" }, { responsavel_id: null }])).toBe(2);
    expect(textoSemResponsavel(0)).toBeNull();
    expect(textoSemResponsavel(1)).toBe("1 atividade sem responsável");
    expect(textoSemResponsavel(3)).toBe("3 atividades sem responsável");
  });
});
