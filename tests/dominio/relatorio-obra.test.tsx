import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import type { Ocorrencia } from "@/lib/dominio/efetivoHH";
import { montarRelatorio, periodoDoRelatorio, type AtividadeRelatorio, type TurnoRelatorio } from "@/lib/dominio/relatorioObra";
import { DocumentoRelatorioObra, fotosDoRelatorio } from "@/lib/rdo/relatorioObra";

const atv = (p: Partial<AtividadeRelatorio>): AtividadeRelatorio => ({
  id: crypto.randomUUID(),
  descricao: "Pintura",
  local: null,
  unidade: "m²",
  qtd_planejada: 10,
  qtd_realizada: 10,
  tipo: null,
  responsavel_id: "rita",
  solicitado_por: null,
  extra_pessoas: null,
  extra_horas: null,
  materiais: [],
  foto_path: null,
  ciencia: null,
  ...p,
});
const parada = (causa: Ocorrencia["causa"], inicio: string, fim: string, foto: string | null = null): Ocorrencia => ({
  id: crypto.randomUUID(),
  responsavel_id: "rita",
  funcao: "Pintor",
  tipo: "parado",
  quantidade: 2,
  hora_inicio: inicio,
  hora_fim: fim,
  destino_responsavel_id: null,
  emprestimo_id: null,
  causa,
  observacao: null,
  foto_path: foto,
  created_at: "2026-11-16T10:00:00Z",
});
const turno = (data: string, atividades: AtividadeRelatorio[], ocorrencias: Ocorrencia[] = []): TurnoRelatorio => ({
  id: crypto.randomUUID(),
  data,
  periodo: "diurno",
  hora_inicio_prevista: "07:00",
  hora_fim_prevista: "17:00",
  hora_inicio_real: null,
  hora_fim_real: null,
  intervalo_inicio: "12:00",
  intervalo_fim: "13:00",
  efetivo: [{ funcao: "Pintor", quantidade: 4, responsavel_id: "rita" }],
  ocorrencias,
  iniciados: [],
  terminados: [],
  atividades,
});

const TURNOS = [
  turno("2026-11-18", [atv({ qtd_realizada: 5 }), atv({ tipo: "extra", descricao: "Calha", extra_pessoas: 2, extra_horas: 3, foto_path: "f1.jpg", ciencia: { nome: "Marcos", ciente_em: "2026-11-20T13:00:00Z" } })], [parada("equipamento", "14:00", "15:00")]),
  turno("2026-11-17", [atv({}), atv({ qtd_realizada: 10 })], [parada("material", "08:00", "10:00", "f2.jpg")]),
];

describe("montarRelatorio", () => {
  it("soma o período, ordena a linha do tempo e põe paradas externas primeiro", () => {
    const r = montarRelatorio(TURNOS, [{ id: "rita", nome: "Rita" }]);
    expect(r.turnos).toBe(2);
    expect(r.linhaDoTempo.map((l) => [l.data, l.concluidas, l.total])).toEqual([
      ["2026-11-17", 2, 2],
      ["2026-11-18", 0, 1],
    ]);
    expect(r.cumprimento).toBeCloseTo(2 / 3);
    expect(r.hh).toBe(72); // 4 pessoas × 9 h × 2 turnos
    expect(r.hhParado).toBe(6); // material 4 + equipamento 2
    expect(r.grupos).toEqual([
      { grupo: "externa", hh: 4, fracao: 4 / 6 },
      { grupo: "interna", hh: 2, fracao: 2 / 6 },
    ]);
    expect(r.paradas.map((p) => [p.causa, p.grupo, p.equipe])).toEqual([
      ["Falta material", "externa", "Rita"],
      ["Equipamento (falta ou quebra)", "interna", "Rita"],
    ]);
    expect(r.extras).toHaveLength(1);
    expect(r.hhExtra).toBe(6);
    expect(r.extrasComCiencia).toBe(1);
    expect(fotosDoRelatorio(r).fotos.map((f) => f.caminho)).toEqual(["f1.jpg", "f2.jpg"]);
  });

  it("gera o PDF (com e sem turnos)", { timeout: 30_000 }, async () => {
    const cabecalho = { obraNome: "Galpão 3", cliente: "Indústria X", empresaNome: "Montagens Silva", periodo: "Semana de 16/11/2026 a 22/11/2026", geradoEm: new Date("2026-11-27T13:00:00Z") };
    for (const turnos of [TURNOS, []]) {
      const relatorio = montarRelatorio(turnos, [{ id: "rita", nome: "Rita" }]);
      const pdf = await renderToBuffer(<DocumentoRelatorioObra cabecalho={cabecalho} relatorio={relatorio} fotos={[]} fotosFora={0} bytes={{}} />);
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    }
  });
});

describe("periodoDoRelatorio", () => {
  it("semana, mês e obra inteira; inválido é nulo", () => {
    expect(periodoDoRelatorio("semana", "2026-11-19", "2026-11-27", "2026-11-01")).toEqual({ de: "2026-11-16", ate: "2026-11-22", rotulo: "Semana de 16/11/2026 a 22/11/2026" });
    expect(periodoDoRelatorio("semana", "2026-11-22", "2026-11-27", "2026-11-01")?.de).toBe("2026-11-16");
    expect(periodoDoRelatorio("mes", "2026-02", "2026-11-27", "2026-01-01")).toEqual({ de: "2026-02-01", ate: "2026-02-28", rotulo: "Mês de fevereiro de 2026" });
    expect(periodoDoRelatorio("obra", null, "2026-11-27", "2026-11-03")).toEqual({ de: "2026-11-03", ate: "2026-11-27", rotulo: "Obra inteira, de 03/11/2026 a 27/11/2026" });
    expect(periodoDoRelatorio("mes", "2026-13", "2026-11-27", "2026-11-03")).toBeNull();
    expect(periodoDoRelatorio("semana", "x", "2026-11-27", "2026-11-03")).toBeNull();
    expect(periodoDoRelatorio(null, null, "2026-11-27", "2026-11-03")).toBeNull();
  });
});
