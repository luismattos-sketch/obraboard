import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HistoricoTurno } from "@/app/(app)/obras/[obraId]/turnos/[turnoId]/HistoricoTurno";
import type { EventoTurno } from "@/lib/dominio/eventos";

const ev = (over: Partial<EventoTurno>): EventoTurno => ({
  id: "e", tipo: "criado", em: "2026-11-10T10:02:00Z", atorTipo: "planejador", atorNome: "Luis", versao: null, motivo: null, ...over,
});

describe("HistoricoTurno", () => {
  it("lista os eventos com hora, rótulo, ator e link da versão", () => {
    const html = renderToStaticMarkup(
      <HistoricoTurno
        eventos={[ev({ id: "1" }), ev({ id: "2", tipo: "fechado", versao: 1, em: "2026-11-10T21:05:00Z" })]}
        versoes={[{ id: "id-v1", numero: 1 }]}
      />,
    );
    expect(html).toContain("Histórico (2)");
    expect(html).toContain("10/11 às 07:02 · Turno criado · Luis");
    expect(html).toMatch(/href="\/api\/rdo\/versao\/id-v1"[^>]*>RDO v1</);
    expect(html).not.toContain("Histórico registrado a partir de");
  });

  it("reaberto mostra o motivo", () => {
    const html = renderToStaticMarkup(
      <HistoricoTurno eventos={[ev({}), ev({ id: "3", tipo: "reaberto", motivo: "Corrigir quantidade" })]} versoes={[]} />,
    );
    expect(html).toContain("Reaberto");
    expect(html).toContain("Corrigir quantidade");
  });

  it("encarregado aparece como link de campo", () => {
    const html = renderToStaticMarkup(
      <HistoricoTurno eventos={[ev({}), ev({ id: "4", tipo: "enviado", atorTipo: "encarregado", atorNome: null })]} versoes={[]} />,
    );
    expect(html).toContain("Enviado pelo campo · Encarregado (link de campo)");
  });

  it("turno anterior à H2 mostra a nota", () => {
    const html = renderToStaticMarkup(<HistoricoTurno eventos={[ev({ tipo: "reaberto", motivo: "x" })]} versoes={[]} />);
    expect(html).toContain("Histórico registrado a partir de 10/11/2026");
  });

  it("vazio e erro", () => {
    const vazio = renderToStaticMarkup(<HistoricoTurno eventos={[]} versoes={[]} />);
    expect(vazio).toContain("Histórico (0)");
    expect(vazio).toContain("Histórico registrado a partir de 10/11/2026");
    expect(renderToStaticMarkup(<HistoricoTurno eventos={null} versoes={[]} />)).toContain("Não foi possível carregar o histórico");
  });

  it("liberado vira \"Check-in registrado\" com link para a foto", () => {
    const html = renderToStaticMarkup(
      <HistoricoTurno eventos={[ev({}), ev({ id: "5", tipo: "liberado" })]} versoes={[]} checkinHref="/obras/o/turnos/t/checkin" />,
    );
    expect(html).toMatch(/Check-in registrado/);
    expect(html).toContain(`href="/obras/o/turnos/t/checkin"`);
  });
});
