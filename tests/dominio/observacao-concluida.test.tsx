import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BlocoAtividades } from "@/components/execucao/BlocoAtividades";
import type { Atividade } from "@/lib/db/atividades";
import { camposExecucao } from "@/lib/db/validacao";

const at = (p: Partial<Atividade> = {}): Atividade => ({ equipe: [],
  id: "a1", turno_id: "t", ordem: 0, descricao: "Andaime", local: null, unidade: "m³", qtd_planejada: 10, qtd_realizada: 10,
  causa: null, observacao: "liberado às 9h", origem_id: null, programacao_atividade_id: null, responsavel_id: null,
  lancado_por_id: null, lancado_em: null, tipo: null, criada_por_id: null, foto_path: null, puxada: false, ...p,
});
const salvar = async () => ({ ok: true as const, dados: { qtd_realizada: 10, causa: null, observacao: null } });

describe("observação em atividade concluída", () => {
  it("camposExecucao mantém a observação e tira a causa", () => {
    expect(camposExecucao(true, { qtd_realizada: 10, causa: "material", observacao: " ok " })).toEqual({
      qtd_realizada: 10, causa: null, observacao: "ok",
    });
  });

  it("concluída mostra Observação e esconde a causa", () => {
    const html = renderToStaticMarkup(<BlocoAtividades atividades={[at()]} salvar={salvar} />);
    expect(html).toContain(">Observação<");
    expect(html).toContain("liberado às 9h");
    expect(html).not.toContain("Causa do não cumprimento");
  });

  it("extra: sem botão Concluída, campo 'Feito' e selo Extra", () => {
    const html = renderToStaticMarkup(<BlocoAtividades atividades={[at({ tipo: "extra", qtd_planejada: 12, qtd_realizada: 12 })]} salvar={salvar} />);
    expect(html).toContain("Total feito hoje (m³)");
    expect(html).not.toContain("✓ Concluída");
    expect(html).toContain(">Extra<");
    expect(html).not.toContain("Previsto:");
  });

  it("adiantada mostra o selo Adiantada", () => {
    const html = renderToStaticMarkup(<BlocoAtividades atividades={[at({ tipo: "adiantada", qtd_realizada: null })]} salvar={salvar} />);
    expect(html).toContain(">Adiantada<");
    expect(html).not.toContain("Causa do não cumprimento");
  });
});
