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

const html = (status: EntradaQuadro["turno"]["status"], visao: "checkin" | "checkout") =>
  renderToStaticMarkup(<Quadro modelo={montarQuadro(base(status))} visao={visao} />);

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
    const h = renderToStaticMarkup(<Quadro modelo={montarQuadro(entrada())} visao="checkout" />);
    expect(h).toContain("6 pessoas · 46,0 HH · 4,0 HH parados");
    expect(h).toContain("+2 Montadores (de Marcos, 13:00–17:00)");
  });
  it("check-in também mostra o recebido", () => {
    const h = renderToStaticMarkup(<Quadro modelo={montarQuadro(entrada())} visao="checkin" />);
    expect(h).toContain("+2 Montadores (de Marcos, 13:00–17:00)");
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
    expect(h).not.toContain("Editar");
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

  it("quadro único: sem seletor Check-in/Check-out nem Editar", () => {
    const h = renderToStaticMarkup(<Quadro modelo={montarQuadro(base("em_campo"))} visao="checkout" navegacao={{ anterior: "/q/x?turno=a", seguinte: null, agora: "/q/x" }} />);
    expect(h).not.toContain(">Check-in<");
    expect(h).not.toContain(">Check-out<");
    expect(h).not.toContain("Editar");
    expect(h).toContain("Agora");
  });

  it("turno fechado", () => {
    expect(html("fechado", "checkout")).toContain("Turno fechado");
  });
});

describe("Quadro: paradas abertas e terminou", () => {
  const e = (): EntradaQuadro => ({
    ...base("em_campo"),
    ocorrencias: [
      { id: "p1", responsavel_id: "m", funcao: "Eletricista", tipo: "parado", quantidade: 2, hora_inicio: "10:40", hora_fim: null,
        destino_responsavel_id: null, emprestimo_id: null, causa: "atividade_predecessora", aguardando_responsavel_id: "m", created_at: "1" },
    ],
    terminados: [{ responsavel_id: "m", terminou_em: "15:20:00" }],
  });
  it("faixa vermelha com duração e equipe aguardada", () => {
    const h = renderToStaticMarkup(<Quadro modelo={montarQuadro(e(), "13:15")} visao="checkout" />);
    expect(h).toContain('role="alert"');
    expect(h).toContain("2 Eletricista parados desde 10:40 · Aguardando outra equipe (Marcos)");
    expect(h).toContain("(2h35)");
    expect(h).toContain("✓ terminou 15:20");
  });
  it("sem paradas: sem alerta", () => {
    expect(html("em_campo", "checkout")).not.toContain('role="alert"');
  });
});

describe("Quadro: equipe prevista", () => {
  it("mostra a equipe prevista da atividade; sem equipe, nada", () => {
    const e = base("em_campo");
    e.atividades[0] = { ...e.atividades[0], equipe: [{ funcao: "Eletricista", quantidade: 2 }, { funcao: "Ajudante", quantidade: 1 }] };
    const h = renderToStaticMarkup(<Quadro modelo={montarQuadro(e)} visao="checkin" />);
    expect(h).toContain("Equipe prevista: 2 Eletricistas + 1 Ajudante");
    expect(html("em_campo", "checkin")).not.toContain("Equipe prevista:");
  });
});

describe("Quadro: resumo do turno", () => {
  const ad: { concluidas: number; total: number; ppc: number | null } = { concluidas: 39, total: 50, ppc: 0.78 };
  const r = (status: EntradaQuadro["turno"]["status"], visao: "checkin" | "checkout", agora?: string, aderenciaObra = ad) =>
    renderToStaticMarkup(<Quadro modelo={montarQuadro(base(status))} visao={visao} agora={agora} aderenciaObra={aderenciaObra} />);
  it("check-out em campo: anel, tempo, ritmo e aderência", () => {
    const h = r("em_campo", "checkout", "13:00");
    expect(h).toContain('aria-label="Resumo do turno"');
    expect(h).toContain("1 de 4 concluídas");
    expect(h).toContain("25%");
    expect(h).toContain("Tempo do turno");
    expect(h).toContain("⚠ abaixo do ritmo");
    expect(h).toContain("Aderência da obra: 78%");
    expect(h).not.toContain("PPC do mês");
  });
  it("turno fechado: resultado final sem tempo", () => {
    const h = r("fechado", "checkout");
    expect(h).toContain("Resultado final");
    expect(h).not.toContain("Tempo do turno");
  });
  it("check-in: só a aderência", () => {
    const h = r("planejado", "checkin");
    expect(h).not.toContain("1 de 4 concluídas");
    expect(h).toContain("Aderência da obra: 78%");
  });
  it("obra sem turno fechado", () => {
    expect(r("em_campo", "checkout", "13:00", { concluidas: 0, total: 0, ppc: null })).toContain("Aderência da obra: sem turno fechado");
  });
});

describe("Quadro: resumo do clima", () => {
  const clima = {
    temp_media: 25, temp_max: 30.4, temp_min: 20.6, chuva_mm: 3.2, choveu: true,
    leituras: [
      { hora: "2026-11-11T07:00", temperatura: 21, chuva_mm: 0, codigo: 0 },
      { hora: "2026-11-11T09:00", temperatura: 26, chuva_mm: 3.2, codigo: 63 },
    ],
  };
  const comClima = (c: { previsao: boolean; parcial: boolean }) =>
    renderToStaticMarkup(<Quadro modelo={montarQuadro(base("planejado"))} visao="checkin" clima={{ clima, aviso: null, ...c }} />);
  it("previsão no check-in: título, condição, máx/mín e chuva", () => {
    const h = comClima({ previsao: true, parcial: false });
    expect(h).toContain('aria-label="Clima"');
    expect(h).toContain("Previsão");
    expect(h).toContain("Chuva");
    expect(h).toContain("máx 30° · mín 21°");
    expect(h).toContain("Chuva prevista · 3,2 mm");
  });
  it("ao vivo e gravado", () => {
    expect(comClima({ previsao: false, parcial: true })).toContain("Clima até agora");
    expect(comClima({ previsao: false, parcial: false })).toContain("Choveu · 3,2 mm");
  });
  it("sem clima: nenhum cartão", () => {
    const h = renderToStaticMarkup(<Quadro modelo={montarQuadro(base("planejado"))} visao="checkin" clima={{ clima: null, aviso: "sem_cidade", parcial: false, previsao: false }} />);
    expect(h).not.toContain('aria-label="Clima"');
  });
});
