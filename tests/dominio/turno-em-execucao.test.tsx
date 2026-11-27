import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(app)/obras/[obraId]/turnos/[turnoId]/acoes", () => ({
  fecharTurnoAcao: vi.fn(),
  reabrirTurnoAcao: vi.fn(),
}));
vi.mock("@/app/(app)/obras/[obraId]/turnos/[turnoId]/acoesExecucao", () => ({
  corrigirEfetivo: vi.fn(),
  corrigirExecucao: vi.fn(),
  corrigirHorario: vi.fn(),
  corrigirIntervalo: vi.fn(),
  criarOcorrenciaAcao: vi.fn(),
  encerrarParadaAcao: vi.fn(),
  enviarFotoExtraAcao: vi.fn(),
  enviarFotoParadaAcao: vi.fn(),
  lancarExtraAcao: vi.fn(),
  puxarDaSemanaAcao: vi.fn(),
  removerForaDoDiaAcao: vi.fn(),
  removerOcorrenciaAcao: vi.fn(),
}));

import { ConfirmarFechamento, TEXTO_CONFIRMACAO } from "@/app/(app)/obras/[obraId]/turnos/[turnoId]/AcoesTurno";
import { TurnoEmExecucao } from "@/app/(app)/obras/[obraId]/turnos/[turnoId]/TurnoEmExecucao";

const base = {
  turnoId: "t",
  hora_inicio_real: null,
  hora_fim_real: null,
  atividades: [],
  efetivo: [],
  opcoesFuncao: [],
  obraId: "o",
  responsaveis: [],
  ocorrencias: [],
  janela: null,
  intervalo: null,
  contexto: { obra: "Obra", data: "2026-11-26", periodo: "diurno" as const, whatsapp: null },
  fotos: {},
};

describe("TurnoEmExecucao", () => {
  it("Fechar turno no cabeçalho, acompanhamento antes, Corrigir execução recolhido", () => {
    const html = renderToStaticMarkup(
      <TurnoEmExecucao {...base} cabecalho={<h1>TITULO</h1>} acompanhamento={<p>ACOMPANHA</p>} recolhidos={<p>RECOLHIDOS</p>} />,
    );
    const iTitulo = html.indexOf("TITULO");
    const iFechar = html.indexOf(">Fechar turno<");
    const iAcomp = html.indexOf("ACOMPANHA");
    const iCorrigir = html.indexOf(">Corrigir execução</summary>");
    const iRecolhidos = html.indexOf("RECOLHIDOS");
    expect(iTitulo).toBeGreaterThanOrEqual(0);
    expect(iFechar).toBeGreaterThan(iTitulo);
    expect(iAcomp).toBeGreaterThan(iFechar);
    expect(iCorrigir).toBeGreaterThan(iAcomp);
    expect(iRecolhidos).toBeGreaterThan(iCorrigir);
    expect(html).toMatch(/<details(?![^>]*\bopen\b)[^>]*><summary[^>]*>Corrigir execução<\/summary>/);
    expect(html).not.toContain("Confirmar fechamento");
  });
});

describe("ConfirmarFechamento", () => {
  it("mostra confirmação, cancelar e o aviso", () => {
    const html = renderToStaticMarkup(
      <ConfirmarFechamento turnoId="t" abertas={[]} janela={null} nome={() => ""} aoCancelar={() => {}} />,
    );
    expect(html).toContain("Confirmar fechamento");
    expect(html).toContain("Cancelar");
    expect(html).toContain(TEXTO_CONFIRMACAO);
  });
});
