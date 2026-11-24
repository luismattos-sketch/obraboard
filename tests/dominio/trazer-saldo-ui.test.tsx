import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/(app)/obras/[obraId]/programacao/[inicio]/acoes", () => ({
  atualizarMetaTrazidaAcao: vi.fn(),
}));

import { AvisoSaldoMudou } from "@/app/(app)/obras/[obraId]/programacao/[inicio]/AvisoSaldoMudou";
import { NaoConcluidasAnterior } from "@/app/(app)/obras/[obraId]/programacao/[inicio]/NaoConcluidasAnterior";
import type { AtividadeResumida } from "@/lib/dominio/programacao";
import type { PendenteAnterior } from "@/lib/dominio/trazerSaldo";

const origem: AtividadeResumida = {
  id: "o1", ordem: 0, descricao: "Pintura do galpão", local: "Galpão 2", unidade: "m", meta: 120, dias: [0], periodo: "diurno",
  causa: null, responsavel_id: "ana", equipe: [], realizado: 100, saldo: 20, situacao: "em_andamento", causaSugerida: null,
};
const pendente: PendenteAnterior = { origem, metaTotal: 120, realizado: 100, saldo: 20 };
const responsaveis = [{ id: "ana", nome: "Ana", ativo: true }];
const lista = (trazidas: string[], pendentes = [pendente]) =>
  renderToStaticMarkup(<NaoConcluidasAnterior pendentes={pendentes} trazidas={new Set(trazidas)} responsaveis={responsaveis} aoTrazer={() => {}} />);

describe("Não concluídas da semana anterior", () => {
  it("mostra o saldo e o botão Trazer", () => {
    const h = lista([]);
    expect(h).toContain("Não concluídas da semana anterior");
    expect(h).toContain("faltam 20 m de 120 m");
    expect(h).toContain("Responsável: Ana");
    expect(h).toContain(">Trazer<");
  });
  it("já trazida: Trazida ✓ e sem botão", () => {
    const h = lista(["o1"]);
    expect(h).toContain("Trazida ✓");
    expect(h).not.toContain(">Trazer<");
  });
  it("sem pendentes: nada", () => {
    expect(lista([], [])).toBe("");
  });
});

describe("Saldo da semana anterior mudou", () => {
  const trazida = { ...origem, id: "n1", meta: 20, trazida_de: "o1", saldo_trazido: 20 };
  const aviso = (saldoAtual: number) => renderToStaticMarkup(<AvisoSaldoMudou atividade={trazida} saldoAtual={saldoAtual} />);
  it("mudou: texto e Atualizar meta", () => {
    const h = aviso(12);
    expect(h).toContain("Saldo da semana anterior mudou: era 20 m, agora 12 m.");
    expect(h).toContain("Atualizar meta");
  });
  it("concluída: texto sem botão", () => {
    const h = aviso(0);
    expect(h).toContain("A semana anterior concluiu esta atividade (era 20 m).");
    expect(h).not.toContain("Atualizar meta");
  });
  it("igual: nada", () => {
    expect(aviso(20)).toBe("");
  });
});
