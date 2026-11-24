import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/(app)/obras/[obraId]/turnos/[turnoId]/acoes", () => ({
  confirmarAtividadeAcao: vi.fn(),
  definirResponsavelAcao: vi.fn(),
  editarAtividadeAcao: vi.fn(),
  moverAtividadeAcao: vi.fn(),
  removerAtividadeAcao: vi.fn(),
  adicionarAtividadeAcao: vi.fn(),
}));
vi.mock("@/components/responsaveis/MenuResponsavel", () => ({ MenuResponsavel: () => null }));

import { ItemAtividade } from "@/app/(app)/obras/[obraId]/turnos/[turnoId]/ItemAtividade";
import type { Atividade } from "@/lib/db/atividades";

const base: Atividade = {
  id: "a1", turno_id: "t1", ordem: 0, descricao: "Montar andaime", local: null, unidade: "m", qtd_planejada: 10,
  qtd_realizada: null, causa: null, observacao: null, origem_id: null, programacao_atividade_id: null, responsavel_id: "ana",
  lancado_por_id: null, lancado_em: null, tipo: null, criada_por_id: null, foto_path: null, puxada: false,
  equipe: [{ funcao: "Montador", quantidade: 4 }],
};
const render = (a: Atividade, planejado: boolean) =>
  renderToStaticMarkup(<ItemAtividade atividade={a} primeira ultima obraId="o" responsaveis={[]} planejado={planejado} />);

describe("Confirmar atividade (turno planejado)", () => {
  it("planejado e não confirmada: botão Confirmar ao lado de Remover", () => {
    const h = render(base, true);
    expect(h).toContain(">Confirmar<");
    expect(h.indexOf("Remover")).toBeLessThan(h.indexOf(">Confirmar<"));
    expect(h).not.toContain("Confirmada");
  });
  it("confirmada: selo Confirmada e sem botão", () => {
    const h = render({ ...base, equipe_confirmada: true }, true);
    expect(h).toContain("Confirmada");
    expect(h).not.toContain(">Confirmar<");
  });
  it("depois de liberado (Editar planejamento): sem Confirmar nem selo", () => {
    const h = render({ ...base, equipe_confirmada: true }, false);
    expect(h).not.toContain("Confirmar");
    expect(h).not.toContain("Confirmada");
  });
});
