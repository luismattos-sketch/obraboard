import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ForaDoDia, montarExtra, rotuloOpcao, TEXTO_SEM_ADIANTAR } from "@/components/execucao/ForaDoDia";
import type { OpcaoPuxar } from "@/lib/dominio/foraDoDia";

const ID = "6f1c2a52-9a0b-4c55-8a39-1f2b3c4d5e6f";
const nada = async () => ({ ok: true as const, dados: undefined });
const pintura: OpcaoPuxar = { programacaoAtividadeId: "p1", descricao: "Pintura", unidade: "m²", dias: [4, 3], saldo: 40, responsavel_id: "rita" };
const base = { adiantar: [pintura], atrasadas: [] as OpcaoPuxar[], puxar: nada, lancarExtra: nada, aoConcluir: () => {} };

describe("ForaDoDia", () => {
  it("mostra os botões; atrasada só quando houver", () => {
    const html = renderToStaticMarkup(<ForaDoDia {...base} />);
    expect(html).toContain("+ Adiantar atividade da semana");
    expect(html).toContain("+ Serviço extra (fora da programação)");
    expect(html).not.toContain("Continuar atividade atrasada");
    expect(renderToStaticMarkup(<ForaDoDia {...base} atrasadas={[pintura]} />)).toContain("Continuar atividade atrasada");
  });

  it("lista aberta mostra a atividade; vazia mostra o texto", () => {
    expect(renderToStaticMarkup(<ForaDoDia {...base} abertoInicial="adiantar" />)).toContain("Pintura — Qui, Sex — saldo 40 m²");
    expect(renderToStaticMarkup(<ForaDoDia {...base} adiantar={[]} abertoInicial="adiantar" />)).toContain(TEXTO_SEM_ADIANTAR);
  });

  it("formulário do extra: campos e responsável só no planejador", () => {
    const campo = renderToStaticMarkup(<ForaDoDia {...base} abertoInicial="extra" />);
    expect(campo).toContain("Quantidade feita");
    expect(campo).not.toContain("Sem responsável");
    const plan = renderToStaticMarkup(<ForaDoDia {...base} abertoInicial="extra" responsaveis={[{ id: "c", nome: "Carlos", ativo: true }]} />);
    expect(plan).toContain("Sem responsável");
    expect(plan).toContain(">Carlos<");
  });

  it("extra tem equipe opcional", () => {
    expect(renderToStaticMarkup(<ForaDoDia {...base} abertoInicial="extra" />)).toContain("Equipe (opcional)");
    expect(montarExtra({ descricao: "Reparo", qtd: "1", unidade: "un", observacao: "", responsavel: "", equipe: [{ funcao: "Eletricista", quantidade: "2" }, { funcao: "", quantidade: "" }] }, ID))
      .toMatchObject({ ok: true, dados: { equipe: [{ funcao: "Eletricista", quantidade: 2 }] } });
  });

  it("rotuloOpcao", () => {
    expect(rotuloOpcao({ ...pintura, unidade: null, saldo: 2.5 })).toBe("Pintura — Qui, Sex — saldo 2,5");
  });
});

describe("montarExtra", () => {
  const f = { descricao: "Troca de iluminação", qtd: "12", unidade: "un", observacao: "", responsavel: "" };
  it("quantidade vazia: Informe a quantidade", () => {
    expect(montarExtra({ ...f, qtd: "" }, ID)).toMatchObject({ ok: false, erro: "Informe a quantidade" });
  });
  it("vírgula decimal e mesmo id", () => {
    expect(montarExtra({ ...f, qtd: "12,5" }, ID)).toEqual({
      ok: true,
      dados: { id: ID, descricao: "Troca de iluminação", unidade: "un", qtd: 12.5, observacao: null, responsavel_id: null, equipe: [], solicitado_por: null },
    });
  });
});
