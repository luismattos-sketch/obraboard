import { describe, expect, it } from "vitest";
import { agruparCausas, passosDoRoteiro, restricoesPorResponsavel } from "@/lib/dominio/roteiro";

const base = {
  obraId: "o1", hoje: "2026-12-02", proximaInicio: "2026-12-07",
  anterior: null, proxima: null, restricoes: { abertas: 0, vencidas: 0 }, turnosHoje: [],
};
const ids = (p: { id: string }[]) => p.map((x) => x.id);

describe("passosDoRoteiro", () => {
  it("obra nova: só Lookahead e Programar", () => {
    const p = passosDoRoteiro(base);
    expect(ids(p)).toEqual(["lookahead", "programar"]);
    expect(p[0]).toMatchObject({ situacao: "feito", detalhe: "Nenhuma restrição aberta", href: "/obras/o1/lookahead" });
    expect(p[1]).toMatchObject({ situacao: "pendente", detalhe: "Semana de 07/12 sem programação", href: "/obras/o1/programacao/2026-12-07" });
  });

  it("semana anterior: encerrada mostra o PPC; programada pede atenção; rascunho some", () => {
    expect(passosDoRoteiro({ ...base, anterior: { inicio: "2026-11-23", status: "encerrada", ppc: 0.78 } })[0])
      .toMatchObject({ id: "encerrar", situacao: "feito", detalhe: "PPC 78%" });
    expect(passosDoRoteiro({ ...base, anterior: { inicio: "2026-11-23", status: "programada", ppc: 0.5 } })[0])
      .toMatchObject({ id: "encerrar", situacao: "atencao", detalhe: "Semana de 23/11 aguardando encerramento", href: "/obras/o1/programacao/2026-11-23" });
    expect(ids(passosDoRoteiro({ ...base, anterior: { inicio: "2026-11-23", status: "rascunho", ppc: null } }))).not.toContain("encerrar");
  });

  it("restrições: vencidas pedem atenção; abertas ficam pendentes", () => {
    expect(passosDoRoteiro({ ...base, restricoes: { abertas: 3, vencidas: 2 } })[0]).toMatchObject({ situacao: "atencao", detalhe: "2 restrições vencidas" });
    expect(passosDoRoteiro({ ...base, restricoes: { abertas: 1, vencidas: 0 } })[0]).toMatchObject({ situacao: "pendente", detalhe: "1 restrição aberta" });
  });

  it("próxima semana programada fica feita", () => {
    const p = passosDoRoteiro({ ...base, proxima: { inicio: "2026-12-07", status: "programada" } });
    expect(p.find((x) => x.id === "programar")).toMatchObject({ situacao: "feito", detalhe: "Semana de 07/12 programada" });
  });

  it("turno de hoje: o que pede ação vem primeiro", () => {
    const p = passosDoRoteiro({ ...base, turnosHoje: [
      { id: "t1", status: "fechado", periodo: "diurno" },
      { id: "t2", status: "em_campo", periodo: "noturno" },
    ] });
    expect(p.find((x) => x.id === "turno")).toMatchObject({ situacao: "pendente", detalhe: "Fechar o turno noturno", href: "/obras/o1/turnos/t2" });
    const q = passosDoRoteiro({ ...base, turnosHoje: [{ id: "t1", status: "planejado", periodo: "diurno" }] });
    expect(q.find((x) => x.id === "turno")).toMatchObject({ detalhe: "Check-in do turno diurno" });
    const r = passosDoRoteiro({ ...base, turnosHoje: [{ id: "t1", status: "fechado", periodo: "diurno" }] });
    expect(r.find((x) => x.id === "turno")).toMatchObject({ situacao: "feito", detalhe: "Turno fechado" });
  });
});

describe("agruparCausas", () => {
  it("conta por causa, mais frequente primeiro; sem causa no fim", () => {
    expect(agruparCausas([{ causa: "material" }, { causa: null }, { causa: "material" }, { causa: "clima" }]))
      .toEqual([
        { causa: "material", rotulo: "Falta material", n: 2 },
        { causa: "clima", rotulo: "Clima", n: 1 },
        { causa: null, rotulo: "Sem causa", n: 1 },
      ]);
  });
});

describe("restricoesPorResponsavel", () => {
  it("só abertas; grupo com vencida primeiro; dentro, vencidas e prazo", () => {
    const r = (responsavel: string, prazo: string | null, removida_em: string | null = null) => ({ responsavel, prazo, removida_em });
    const g = restricoesPorResponsavel([r("Ana", "2026-12-10"), r("Bruno", "2026-12-01"), r("Ana", null), r("Bruno", "2026-12-20"), r("Caio", "2026-11-01", "x")], "2026-12-02");
    expect(g.map((x) => x.responsavel)).toEqual(["Bruno", "Ana"]);
    expect(g[0].itens.map((i) => [i.prazo, i.vencida])).toEqual([["2026-12-01", true], ["2026-12-20", false]]);
    expect(g[1].itens.map((i) => i.prazo)).toEqual(["2026-12-10", null]);
  });
});
