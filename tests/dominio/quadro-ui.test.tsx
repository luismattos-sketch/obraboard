import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Quadro } from "@/components/quadro/Quadro";
import { montarQuadro, type EntradaQuadro } from "@/lib/dominio/quadro";

const base = (status: EntradaQuadro["turno"]["status"]): EntradaQuadro => ({
  obra: { id: "o", nome: "Obra Laminação" },
  turno: {
    id: "t", data: "2026-11-11", periodo: "diurno", status,
    hora_inicio_prevista: "07:00", hora_fim_prevista: "15:48", hora_inicio_real: null, hora_fim_real: null,
  },
  responsaveis: [{ id: "m", nome: "Marcos", ativo: true }],
  atividades: [
    { id: "1", ordem: 0, descricao: "Lançamento de cabos", local: "CCM-2", unidade: "m", qtd_planejada: 120, qtd_realizada: 80, causa: "material", programada: true, responsavel_id: "m" },
    { id: "2", ordem: 1, descricao: "Teste de isolação", local: null, unidade: "cir", qtd_planejada: 8, qtd_realizada: null, causa: "atividade_predecessora", programada: true, responsavel_id: "m" },
    { id: "3", ordem: 2, descricao: "Painel PN-04", local: null, unidade: "un", qtd_planejada: 1, qtd_realizada: 1, causa: null, programada: false, responsavel_id: "m" },
    { id: "4", ordem: 3, descricao: "Inspeção de andaimes", local: null, unidade: "un", qtd_planejada: 3, qtd_realizada: null, causa: null, programada: true, responsavel_id: null },
  ],
  efetivo: [{ funcao: "Eletricista", quantidade: 3, responsavel_id: "m" }],
});

const html = (status: EntradaQuadro["turno"]["status"], visao: "checkin" | "checkout", publico = false) =>
  renderToStaticMarkup(
    <Quadro modelo={montarQuadro(base(status))} visao={visao} publico={publico} editarHref={publico ? null : "/obras/o/turnos/t"} />,
  );

describe("Quadro: empréstimo e parados", () => {
  const entrada = (): EntradaQuadro => ({
    ...base("em_campo"),
    turno: { ...base("em_campo").turno, hora_fim_prevista: "17:00", intervalo_inicio: "12:00", intervalo_fim: "13:00" },
    responsaveis: [{ id: "m", nome: "Marcos", ativo: true }, { id: "a", nome: "Ana", ativo: true }],
    efetivo: [{ funcao: "Montador", quantidade: 6, responsavel_id: "m" }],
    ocorrencias: [
      { id: "o1", responsavel_id: "m", funcao: "Montador", tipo: "emprestimo", quantidade: 2, hora_inicio: "13:00", hora_fim: null,
        destino_responsavel_id: "a", emprestimo_id: null, causa: null, created_at: "1" },
      { id: "o2", responsavel_id: "m", funcao: "Montador", tipo: "parado", quantidade: 2, hora_inicio: "08:00", hora_fim: "10:00",
        destino_responsavel_id: null, emprestimo_id: null, causa: "material", created_at: "2" },
    ],
  });
  it("check-out mostra HH parado e o recebido na equipe destino", () => {
    const h = renderToStaticMarkup(<Quadro modelo={montarQuadro(entrada())} visao="checkout" publico />);
    expect(h).toContain("6 pessoas · 46,0 HH · 4,0 HH parados");
    expect(h).toContain("+2 Montador (de Marcos, 13:00–17:00)");
  });
  it("check-in também mostra o recebido", () => {
    const h = renderToStaticMarkup(<Quadro modelo={montarQuadro(entrada())} visao="checkin" publico />);
    expect(h).toContain("+2 Montador (de Marcos, 13:00–17:00)");
  });
  it("sem parados não mostra HH parados", () => {
    expect(html("em_campo", "checkout")).not.toContain("HH parados");
  });
});

describe("Quadro", () => {
  it("check-in: selo, faixas, extra e 'Sem responsável' por último", () => {
    const h = html("planejado", "checkin");
    expect(h).toContain("CHECK-IN");
    expect(h).toContain("Obra Laminação");
    expect(h).toContain("Marcos");
    expect(h).toContain("EXTRA");
    expect(h).toContain("3 Eletricista");
    expect(h.indexOf("Marcos")).toBeLessThan(h.indexOf("Sem responsável"));
    expect(h).toContain("Editar");
  });

  it("check-out: resumo da equipe, extras à parte, causa e HH", () => {
    const h = html("em_campo", "checkout");
    expect(h).toContain("CHECK-OUT");
    expect(h).toContain("0 de 2 programadas · 0%");
    expect(h).toContain("+1 extra");
    expect(h).toContain("80 / 120 m");
    expect(h).toContain("Falta material");
    expect(h).toContain("26,4 HH");
  });

  it("público: sem Editar", () => {
    expect(html("em_campo", "checkout", true)).not.toContain("Editar");
  });

  it("turno fechado", () => {
    expect(html("fechado", "checkout")).toContain("Turno fechado");
  });
});
