import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Ocorrencia } from "@/lib/dominio/efetivoHH";

vi.mock("@/app/(app)/obras/[obraId]/turnos/[turnoId]/acoesExecucao", () => ({ paradasDoTurnoAcao: vi.fn() }));

import { ParadasNoFechamento } from "@/app/(app)/obras/[obraId]/turnos/[turnoId]/AcoesTurno";
import { FaixaParadasVisao } from "@/app/(app)/obras/[obraId]/turnos/[turnoId]/FaixaParadas";

const aberta = (p: Partial<Ocorrencia> = {}): Ocorrencia => ({
  id: "p1", responsavel_id: "joao", funcao: "Mecânico", tipo: "parado", quantidade: 2, hora_inicio: "10:40:00", hora_fim: null,
  destino_responsavel_id: null, emprestimo_id: null, causa: "material", created_at: "1", ...p,
});
const nome = (id: string | null) => ({ joao: "João", ana: "Ana" })[id ?? ""] ?? "Sem responsável";

describe("ParadasNoFechamento", () => {
  it("lista cada parada aberta com o fim sugerido (fim do turno)", () => {
    const html = renderToStaticMarkup(
      <ParadasNoFechamento abertas={[aberta()]} janela={{ inicio: "07:00", fim: "17:00" }} nome={nome} />,
    );
    expect(html).toContain("João · Mecânico: 2 parados desde 10:40 · Falta material");
    expect(html).toContain('name="fim_p1"');
    expect(html).toContain('value="17:00"');
  });
  it("sem paradas abertas: nada", () => {
    expect(renderToStaticMarkup(<ParadasNoFechamento abertas={[]} janela={null} nome={nome} />)).toBe("");
  });
});

describe("FaixaParadasVisao", () => {
  it("paradas abertas e equipes que terminaram", () => {
    const html = renderToStaticMarkup(
      <FaixaParadasVisao abertas={[aberta()]} terminados={[{ responsavel_id: "ana", terminou_em: "15:20:00" }]} nome={nome} mudou={false} />,
    );
    expect(html).toContain("João · Mecânico: 2 parados desde 10:40 · Falta material");
    expect(html).toContain("✓ Ana terminou às 15:20");
    expect(html).not.toContain("Atualizar números");
  });
  it("mudou desde que a página abriu: oferece atualizar", () => {
    expect(renderToStaticMarkup(<FaixaParadasVisao abertas={[]} terminados={[]} nome={nome} mudou />)).toContain("Atualizar números");
  });
  it("equipes que iniciaram vêm antes das que terminaram", () => {
    const html = renderToStaticMarkup(
      <FaixaParadasVisao abertas={[]} iniciados={[{ responsavel_id: "joao", iniciou_em: "07:05:00" }]} terminados={[{ responsavel_id: "ana", terminou_em: "15:20:00" }]} nome={nome} mudou={false} />,
    );
    expect(html).toContain("▶ João iniciou às 07:05");
    expect(html.indexOf("iniciou")).toBeLessThan(html.indexOf("terminou"));
  });
  it("nada a mostrar", () => {
    expect(renderToStaticMarkup(<FaixaParadasVisao abertas={[]} terminados={[]} nome={nome} mudou={false} />)).toBe("");
  });
});
