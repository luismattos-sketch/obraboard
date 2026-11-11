import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ListaRdos } from "@/components/rdo/ListaRdos";
import { FiltrosRdo } from "@/components/rdo/FiltrosRdo";
import type { GrupoRdo, ItemVersao } from "@/lib/dominio/historico-rdo";

const item = (over: Partial<ItemVersao>): ItemVersao => ({
  id: "v", turnoId: "t", obraId: "o", obraNome: "Edifício Aurora", numero: 1, emitidoEm: "2026-11-09T21:40:00Z",
  retroativa: false, data: "2026-11-09", periodo: "diurno", turnoStatus: "fechado", percentual: 2 / 3, ...over,
});
const grupo = (over: Partial<GrupoRdo> = {}): GrupoRdo => {
  const atual = item({ id: "id-v2", numero: 2, emitidoEm: "2026-11-10T11:15:00Z" });
  return {
    turnoId: "t", obraId: "o", obraNome: "Edifício Aurora", data: "2026-11-09", periodo: "diurno", reaberto: false,
    atual, anteriores: [item({ id: "id-v1", numero: 1 })], ...over,
  };
};

describe("ListaRdos", () => {
  it("mostra a versão atual e as anteriores no expansível", () => {
    const html = renderToStaticMarkup(<ListaRdos grupos={[grupo()]} mostrarObra={false} />);
    expect(html).toContain("09/11/2026");
    expect(html).toContain("Diurno");
    expect(html).toContain("67%");
    expect(html).toContain("v2");
    expect(html).toMatch(/href="\/api\/rdo\/versao\/id-v2"[^>]*>Baixar</);
    const detalhes = html.slice(html.indexOf("<details"));
    expect(detalhes).toContain("v1 · emitida 09/11 às 18:40");
    expect(detalhes).toContain('href="/api/rdo/versao/id-v1"');
    expect(html).not.toContain("Edifício Aurora");
    expect(html).not.toContain("Turno reaberto");
  });

  it("sem anteriores não tem expansível", () => {
    const html = renderToStaticMarkup(<ListaRdos grupos={[grupo({ anteriores: [] })]} mostrarObra={false} />);
    expect(html).not.toContain("<details");
  });

  it("turno reaberto e nome da obra", () => {
    const html = renderToStaticMarkup(<ListaRdos grupos={[grupo({ reaberto: true })]} mostrarObra />);
    expect(html).toContain("Turno reaberto");
    expect(html).toContain("Edifício Aurora");
  });

  it("lista vazia com filtro ativo não diz que não há RDO", () => {
    const html = renderToStaticMarkup(<ListaRdos grupos={[]} mostrarObra={false} filtrado />);
    expect(html).toContain("Nenhum RDO neste filtro.");
    expect(html).not.toContain("Nenhum RDO emitido ainda");
  });

  it("lista vazia explica quando o RDO nasce", () => {
    const html = renderToStaticMarkup(<ListaRdos grupos={[]} mostrarObra={false} />);
    expect(html).toContain("Nenhum RDO emitido ainda. O RDO é registrado quando você fecha um turno.");
  });
});

describe("FiltrosRdo", () => {
  it("formulário GET com meses por extenso e mês atual selecionado", () => {
    const html = renderToStaticMarkup(<FiltrosRdo acao="/obras/o/rdos" meses={["2026-11", "2026-10"]} mes="2026-10" />);
    const form = html.match(/<form[^>]*>/)![0];
    expect(form).toContain('method="get"');
    expect(form).toContain('action="/obras/o/rdos"');
    expect(html).toContain('<option value="">Todos</option>');
    expect(html).toMatch(/<option value="2026-10" selected="">outubro de 2026<\/option>/);
    expect(html).not.toContain('name="obra"');
  });

  it("mês da URL sem RDO continua visível como selecionado", () => {
    const html = renderToStaticMarkup(<FiltrosRdo acao="/rdos" meses={["2026-11"]} mes="2025-01" />);
    expect(html).toMatch(/<option value="2025-01" selected="">janeiro de 2025<\/option>/);
  });

  it("filtro de obra opcional", () => {
    const html = renderToStaticMarkup(
      <FiltrosRdo acao="/rdos" meses={[]} mes={null} obras={[{ id: "o1", nome: "Aurora" }]} obra="o1" />,
    );
    expect(html).toContain('name="obra"');
    expect(html).toMatch(/<option value="o1" selected="">Aurora<\/option>/);
  });
});
