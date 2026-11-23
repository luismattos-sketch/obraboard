import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BlocoAtividades } from "@/components/execucao/BlocoAtividades";
import type { Atividade } from "@/lib/db/atividades";
import { camposAbertos } from "@/lib/dominio/cardCausa";

const at = (p: Partial<Atividade> = {}): Atividade => ({ equipe: [],
  id: "a1", turno_id: "t", ordem: 0, descricao: "Montagem", local: null, unidade: "tubo", qtd_planejada: 8, qtd_realizada: 3,
  causa: null, observacao: null, origem_id: null, programacao_atividade_id: null, responsavel_id: null,
  lancado_por_id: null, tipo: null, criada_por_id: null, foto_path: null, puxada: false, ...p,
});
const salvar = async () => ({ ok: true as const, dados: { qtd_realizada: 3, causa: null, observacao: null } });
const base = { naoConcluida: true, causa: "", obs: "", abriuCausa: false, abriuObs: false };

describe("camposAbertos", () => {
  it("parcial sem nada: tudo fechado", () => {
    expect(camposAbertos(base)).toEqual({ causa: false, obs: false });
  });
  it("cobrado (erro): abre a causa", () => {
    expect(camposAbertos({ ...base, erro: "x" })).toEqual({ causa: true, obs: false });
  });
  it("cobrado com Outro: abre também a observação", () => {
    expect(camposAbertos({ ...base, erro: "x", causa: "outro" })).toEqual({ causa: true, obs: true });
  });
  it("observação com texto fica aberta", () => {
    expect(camposAbertos({ ...base, obs: " x " }).obs).toBe(true);
  });
  it("concluída nunca abre a causa", () => {
    expect(camposAbertos({ ...base, naoConcluida: false, erro: "x", abriuCausa: true }).causa).toBe(false);
  });
  it("tocou no link: abre", () => {
    expect(camposAbertos({ ...base, abriuCausa: true, abriuObs: true })).toEqual({ causa: true, obs: true });
  });
});

describe("card curto", () => {
  it("parcial sem cobrança: só os links, sem campos nem vermelho", () => {
    const html = renderToStaticMarkup(<BlocoAtividades atividades={[at()]} salvar={salvar} />);
    expect(html).toContain("Não vai dar para concluir? Informar causa");
    expect(html).toContain("+ Observação");
    expect(html).not.toContain("Causa do não cumprimento");
    expect(html).not.toContain(">Observação<");
  });
  it("links com área de toque para luva (44 px)", () => {
    const html = renderToStaticMarkup(<BlocoAtividades atividades={[at()]} salvar={salvar} />);
    expect(html.match(/<button[^>]*min-h-11[^>]*>(Não vai dar|\+ Observação)/g)?.length).toBe(2);
  });
  it("cobrado: abre a causa com aviso em tom de alerta", () => {
    const html = renderToStaticMarkup(
      <BlocoAtividades atividades={[at()]} salvar={salvar} erros={{ a1: "Informe a causa para atividades não concluídas" }} />,
    );
    expect(html).toContain("Causa do não cumprimento");
    expect(html).toContain("Informe a causa para atividades não concluídas");
    expect(html).not.toContain("text-perigo");
    expect(html).not.toContain("Não vai dar para concluir?");
  });
  it("causa já escolhida aparece aberta", () => {
    const html = renderToStaticMarkup(<BlocoAtividades atividades={[at({ causa: "material" })]} salvar={salvar} />);
    expect(html).toContain("Causa do não cumprimento");
  });
  it("somente leitura sem valores: sem links nem campos", () => {
    const html = renderToStaticMarkup(<BlocoAtividades atividades={[at()]} salvar={salvar} somenteLeitura />);
    expect(html).not.toContain("Informar causa");
    expect(html).not.toContain("+ Observação");
    expect(html).not.toContain("Causa do não cumprimento");
  });
});
