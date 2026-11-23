import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BlocoAtividades } from "@/components/execucao/BlocoAtividades";
import { IndicadorSalvo } from "@/components/execucao/IndicadorSalvo";
import type { Atividade } from "@/lib/db/atividades";

const at = (p: Partial<Atividade> = {}): Atividade => ({ equipe: [],
  id: "a1", turno_id: "t", ordem: 0, descricao: "Montagem", local: null, unidade: "tubo", qtd_planejada: 8, qtd_realizada: 3,
  causa: null, observacao: null, origem_id: null, programacao_atividade_id: null, responsavel_id: null,
  lancado_por_id: null, tipo: null, criada_por_id: null, foto_path: null, puxada: false, ...p,
});
const salvar = async () => ({ ok: true as const, dados: { qtd_realizada: 3, causa: null, observacao: null } });

describe("card do lançamento", () => {
  it("parcial: Total feito hoje, Somar, Concluída e a dica", () => {
    const html = renderToStaticMarkup(<BlocoAtividades atividades={[at()]} salvar={salvar} />);
    expect(html).toContain("Total feito hoje (tubo)");
    expect(html).not.toContain("Executado");
    expect(html).toMatch(/<button[^>]*min-h-1[12][^>]*>\+ Somar<\/button>/);
    expect(html).toContain("✓ Concluída");
    expect(html).toContain("salva sozinho");
  });
  it("extra: Somar sem Concluída", () => {
    const html = renderToStaticMarkup(
      <BlocoAtividades atividades={[at({ tipo: "extra", qtd_planejada: 12, qtd_realizada: 12 })]} salvar={salvar} />,
    );
    expect(html).toContain("Total feito hoje (tubo)");
    expect(html).toContain("+ Somar");
    expect(html).not.toContain("✓ Concluída");
  });
  it("somente leitura: sem Somar e sem dica", () => {
    const html = renderToStaticMarkup(<BlocoAtividades atividades={[at()]} salvar={salvar} somenteLeitura />);
    expect(html).not.toContain("+ Somar");
    expect(html).not.toContain("salva sozinho");
  });
});

describe("IndicadorSalvo com dica", () => {
  it("ocioso mostra a dica", () => {
    expect(renderToStaticMarkup(<IndicadorSalvo estado="ocioso" dica="salva sozinho" />)).toContain("salva sozinho");
  });
  it("nota tem prioridade sobre a dica", () => {
    const html = renderToStaticMarkup(<IndicadorSalvo estado="ocioso" dica="salva sozinho" nota="Você tinha digitado 5" />);
    expect(html).toContain("Você tinha digitado 5");
    expect(html).not.toContain("salva sozinho");
  });
  it("salvo esconde a dica", () => {
    expect(renderToStaticMarkup(<IndicadorSalvo estado="salvo" dica="salva sozinho" />)).not.toContain("salva sozinho");
  });
});
