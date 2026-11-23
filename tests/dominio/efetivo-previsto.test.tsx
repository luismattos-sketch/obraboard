import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/(app)/obras/[obraId]/acoesResponsaveis", () => ({ criarResponsavelAcao: vi.fn() }));

import { BlocoEfetivo, chaveBloco, passoQuantidade, TEXTO_PREVISTO } from "@/components/execucao/BlocoEfetivo";
import { EfetivoPorEquipe } from "@/components/execucao/EfetivoPorEquipe";

const salvar = vi.fn(async () => ({ ok: true as const, dados: undefined }));
const previsto = [{ funcao: "Soldador", quantidade: 2 }];

describe("efetivo previsto", () => {
  it("sem efetivo gravado: mostra o previsto para confirmar, sem salvar", () => {
    const html = renderToStaticMarkup(<BlocoEfetivo inicial={[]} previsto={previsto} opcoes={["Soldador"]} salvar={salvar} />);
    expect(html).toContain(TEXTO_PREVISTO);
    expect(html).toContain("Confirmar equipe");
    expect(html).toContain('value="2"');
    expect(salvar).not.toHaveBeenCalled();
  });
  it("com efetivo gravado: ignora o previsto", () => {
    const html = renderToStaticMarkup(<BlocoEfetivo inicial={[{ funcao: "Soldador", quantidade: 5 }]} previsto={previsto} opcoes={["Soldador"]} salvar={salvar} />);
    expect(html).not.toContain(TEXTO_PREVISTO);
    expect(html).toContain('value="5"');
  });
  it("somente leitura não mostra o previsto", () => {
    expect(renderToStaticMarkup(<BlocoEfetivo inicial={[]} previsto={previsto} opcoes={[]} somenteLeitura salvar={salvar} />)).not.toContain(TEXTO_PREVISTO);
  });
  it("botões − e +", () => {
    const html = renderToStaticMarkup(<BlocoEfetivo inicial={[{ funcao: "Soldador", quantidade: 1 }]} opcoes={["Soldador"]} salvar={salvar} />);
    expect(html).toContain('aria-label="Diminuir"');
    expect(html).toContain('aria-label="Aumentar"');
    expect(passoQuantidade("1", -1)).toBe("1");
    expect(passoQuantidade("2", 1)).toBe("3");
    expect(passoQuantidade("", 1)).toBe("1");
    expect(passoQuantidade("3", -1)).toBe("2");
  });
  it("equipe só com previsto aparece no efetivo por equipe", () => {
    const html = renderToStaticMarkup(
      <EfetivoPorEquipe obraId="o" responsaveis={[{ id: "ana", nome: "Ana", ativo: true }]} efetivo={[]} opcoesFuncao={["Soldador"]}
        previsto={new Map([["ana", previsto]])} salvar={salvar} />,
    );
    expect(html).toContain("Ana");
    expect(html).toContain(TEXTO_PREVISTO);
  });
  it("chave do bloco muda com o previsto enquanto nada foi gravado", () => {
    expect(chaveBloco([], previsto)).not.toBe(chaveBloco([], [...previsto, { funcao: "Ajudante", quantidade: 1 }]));
    expect(chaveBloco([{ funcao: "Soldador", quantidade: 5 }], previsto)).toBe(chaveBloco([{ funcao: "Soldador", quantidade: 5 }], []));
  });
});
