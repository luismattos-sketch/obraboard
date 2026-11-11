import { describe, expect, it } from "vitest";
import { emissaoDaVersao, FormatoRdoDesconhecido, lerFoto, linhasEmissao, type VersaoRdo } from "@/lib/rdo/versao";
import { dataHoraCurta } from "@/lib/rdo/formatar";

const foto = {
  obra: { id: "o", empresa_id: "e", nome: "Edifício Aurora", cliente: "Ágil", endereco: null },
  turno: {
    id: "t", obra_id: "o", data: "2026-11-09", periodo: "diurno",
    hora_inicio_prevista: "07:00:00", hora_fim_prevista: "16:00:00", hora_inicio_real: "07:10:00", hora_fim_real: "16:00:00",
    enviado_em: "2026-11-09T20:00:00+00:00", fechado_em: "2026-11-09T21:40:00+00:00",
  },
  atividades: [
    { id: "a2", ordem: 2, descricao: "B", local: null, unidade: "m", qtd_planejada: 5, qtd_realizada: 5, causa: null, observacao: null, origem_id: null },
    { id: "a1", ordem: 1, descricao: "A", local: "Bloco A", unidade: "m³", qtd_planejada: 10, qtd_realizada: 4, causa: "material", observacao: "x", origem_id: null },
  ],
  efetivo: [{ id: "e1", funcao: "Pedreiro", quantidade: 3 }],
  clima: [{ periodo: "manha", condicao: "bom", impediu: false }],
};

const versao = (over: Partial<VersaoRdo> = {}): VersaoRdo => ({
  id: "v", turno_id: "t", obra_id: "o", numero: 1, emitido_em: "2026-11-10T11:15:00+00:00",
  retroativa: false, formato: 1, dados: foto, ...over,
});

describe("lerFoto", () => {
  it("devolve o TurnoCompleto fechado com atividades em ordem", () => {
    const t = lerFoto(versao());
    expect(t.status).toBe("fechado");
    expect(t.token_hash).toBeNull();
    expect(t.obra).toMatchObject({ nome: "Edifício Aurora", created_at: "" });
    expect(t.atividades.map((a) => a.descricao)).toEqual(["A", "B"]);
    expect(t.atividades.every((a) => a.turno_id === "t")).toBe(true);
    expect(t.efetivo).toEqual([{ id: "e1", turno_id: "t", funcao: "Pedreiro", quantidade: 3 }]);
    expect(t.clima).toEqual([{ turno_id: "t", periodo: "manha", condicao: "bom", impediu: false }]);
    expect(t.fechado_em).toBe("2026-11-09T21:40:00+00:00");
  });
  it("recusa formato desconhecido", () => {
    expect(() => lerFoto(versao({ formato: 2 }))).toThrow(FormatoRdoDesconhecido);
  });
});

describe("linhasEmissao", () => {
  const emitido = new Date("2026-11-10T11:15:00Z");
  const anterior = { numero: 1, emitidoEm: new Date("2026-11-09T21:40:00Z") };
  it("v1", () => {
    expect(linhasEmissao({ tipo: "oficial", numero: 1, emitidoEm: emitido, retroativa: false })).toEqual({
      destaque: "RDO oficial · Versão 1 · Emitido em 10/11/2026 às 08:15 (horário de Brasília)",
      rodape: "Versão 1 · Emitido em 10/11/2026 às 08:15 (horário de Brasília)",
    });
  });
  it("v2 cita a anterior", () => {
    expect(linhasEmissao({ tipo: "oficial", numero: 2, emitidoEm: emitido, retroativa: false, anterior }).destaque).toBe(
      "RDO oficial · Versão 2 · substitui a versão 1, emitida em 09/11/2026 às 18:40 · Emitido em 10/11/2026 às 08:15 (horário de Brasília)",
    );
  });
  it("v2 com motivo da correção", () => {
    expect(linhasEmissao({ tipo: "oficial", numero: 2, emitidoEm: emitido, retroativa: false, anterior, motivo: "Corrigir quantidade" }).destaque).toBe(
      "RDO oficial · Versão 2 · substitui a versão 1, emitida em 09/11/2026 às 18:40 · Motivo da correção: Corrigir quantidade · Emitido em 10/11/2026 às 08:15 (horário de Brasília)",
    );
  });
  it("retroativa avisa", () => {
    expect(linhasEmissao({ tipo: "oficial", numero: 1, emitidoEm: emitido, retroativa: true }).destaque).toMatch(
      / · versão registrada retroativamente$/,
    );
  });
  it("rascunho", () => {
    expect(linhasEmissao({ tipo: "rascunho", geradoEm: emitido })).toEqual({
      destaque: "Rascunho — não é o RDO oficial · Gerado em 10/11/2026 às 08:15 (horário de Brasília)",
      rodape: "Rascunho · Gerado em 10/11/2026 às 08:15 (horário de Brasília)",
    });
  });
});

describe("emissaoDaVersao", () => {
  it("sem anterior", () => {
    expect(emissaoDaVersao(versao())).toEqual({
      tipo: "oficial", numero: 1, emitidoEm: new Date("2026-11-10T11:15:00Z"), retroativa: false,
    });
  });
  it("com anterior", () => {
    const e = emissaoDaVersao(versao({ numero: 2, retroativa: true }), { numero: 1, emitido_em: "2026-11-09T21:40:00Z" });
    expect(e).toEqual({
      tipo: "oficial", numero: 2, emitidoEm: new Date("2026-11-10T11:15:00Z"), retroativa: true,
      anterior: { numero: 1, emitidoEm: new Date("2026-11-09T21:40:00Z") },
    });
  });
});

describe("emissaoDaVersao com motivo", () => {
  const comMotivo = { ...foto, turno: { ...foto.turno, motivo_reabertura: "X" } };
  it("v2 lê o motivo da foto", () => {
    const e = emissaoDaVersao(versao({ numero: 2, dados: comMotivo }), { numero: 1, emitido_em: "2026-11-09T21:40:00Z" });
    expect(e).toMatchObject({ tipo: "oficial", motivo: "X" });
  });
  it("v1 ignora motivo", () => {
    expect(emissaoDaVersao(versao({ dados: comMotivo }))).not.toHaveProperty("motivo");
  });
  it("foto da H1 sem o campo: sem motivo", () => {
    expect(emissaoDaVersao(versao({ numero: 2 }), { numero: 1, emitido_em: "2026-11-09T21:40:00Z" })).not.toHaveProperty("motivo");
  });
});

describe("dataHoraCurta", () => {
  it("dia/mês e hora em Brasília", () => {
    expect(dataHoraCurta(new Date("2026-11-09T21:40:00Z"))).toBe("09/11 às 18:40");
  });
});
