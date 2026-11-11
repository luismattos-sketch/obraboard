import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import type { ItemVersao } from "@/lib/dominio/historico-rdo";
import type { ItemLote } from "@/lib/dominio/lote-rdo";
import { montarLote, renderizarCapa, type CabecalhoLote } from "@/lib/rdo/lote";
import { renderizarRdo } from "@/lib/rdo/responder";
import { emissaoDaVersao, lerFoto, type VersaoRdo } from "@/lib/rdo/versao";

const foto = (data: string, obraNome = "Obra") => ({
  obra: { id: "o", empresa_id: "e", nome: obraNome, cliente: null, endereco: null },
  turno: {
    id: `t-${data}`, obra_id: "o", data, periodo: "diurno",
    hora_inicio_prevista: "07:00:00", hora_fim_prevista: "16:00:00", hora_inicio_real: null, hora_fim_real: null,
    enviado_em: null, fechado_em: "2026-11-09T21:40:00+00:00",
  },
  atividades: [
    { id: "a1", ordem: 1, descricao: "Alvenaria", local: null, unidade: "m²", qtd_planejada: 10, qtd_realizada: 4, causa: "material", observacao: null, origem_id: null },
  ],
  efetivo: [],
  clima: [],
});

const versao = (id: string, data: string, obraNome?: string): VersaoRdo => ({
  id, turno_id: `t-${data}`, obra_id: "o", numero: 1, emitido_em: "2026-11-10T11:15:00+00:00",
  retroativa: false, formato: 1, dados: foto(data, obraNome),
});

const itemLote = (id: string, data: string, over: Partial<ItemVersao> = {}): ItemLote => ({
  atual: {
    id, turnoId: `t-${data}`, obraId: "o", obraNome: "Obra", numero: 1, emitidoEm: "2026-11-10T11:15:00+00:00",
    retroativa: false, data, periodo: "diurno", turnoStatus: "fechado", percentual: 0.4, ...over,
  },
  reaberto: false,
});

const cab: CabecalhoLote = { mes: "2026-11", obraNome: "Obra", geradoEm: new Date("2026-11-10T17:32:00Z") };
const paginas = async (b: Uint8Array) => (await PDFDocument.load(b)).getPageCount();

describe("montarLote", () => {
  it("páginas = capa + soma dos RDOs", async () => {
    const vs = [versao("v1", "2026-11-02"), versao("v2", "2026-11-03")];
    const lote = [itemLote("v1", "2026-11-02"), itemLote("v2", "2026-11-03")];
    const pdf = await montarLote(lote, vs, cab);
    expect(Buffer.from(pdf).subarray(0, 4).toString("latin1")).toBe("%PDF");
    const individuais = await Promise.all(vs.map(async (v) => paginas(await renderizarRdo(lerFoto(v), emissaoDaVersao(v)))));
    const capa = await renderizarCapa(cab, lote, individuais);
    expect(await paginas(pdf)).toBe((await paginas(capa.buffer)) + individuais.reduce((a, b) => a + b, 0));
    expect((await PDFDocument.load(pdf)).getTitle()).toBe("RDOs — Obra — novembro de 2026");
  }, 60000);

  it("lote de 30 RDOs cabe folgado no limite de resposta", async () => {
    const datas = Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`);
    const pdf = await montarLote(datas.map((d) => itemLote(`v${d}`, d)), datas.map((d) => versao(`v${d}`, d)), cab);
    expect(pdf.length).toBeLessThan(1_500_000);
  }, 60000);

  it("versão faltando falha", async () => {
    await expect(montarLote([itemLote("v1", "2026-11-02")], [], cab)).rejects.toThrow();
  });

  it("emoji no nome da obra não quebra", async () => {
    const pdf = await montarLote(
      [itemLote("v1", "2026-11-02", { obraNome: "Obra 🏗" })],
      [versao("v1", "2026-11-02", "Obra 🏗")],
      { ...cab, obraNome: "Obra 🏗" },
    );
    expect(Buffer.from(pdf).subarray(0, 4).toString("latin1")).toBe("%PDF");
  }, 30000);
});

describe("renderizarCapa", () => {
  it("índice longo: páginas batem", async () => {
    const lote = Array.from({ length: 60 }, (_, i) => itemLote(`v${i}`, `2026-11-${String((i % 28) + 1).padStart(2, "0")}`));
    const { buffer, paginas: p } = await renderizarCapa({ ...cab, obraNome: null }, lote, Array(60).fill(1));
    const P = await paginas(buffer);
    expect(P).toBeGreaterThanOrEqual(2);
    expect(p[0]).toBe(P + 1);
    expect(p[59]).toBe(P + 60);
  }, 30000);
});
