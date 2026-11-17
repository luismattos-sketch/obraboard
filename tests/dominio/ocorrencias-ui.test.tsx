import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FormOcorrencia, montarOcorrencia, OcorrenciasEfetivo, type FormDados } from "@/components/execucao/OcorrenciasEfetivo";
import { pareceParado, validarEfetivo } from "@/lib/db/validacao";
import type { HHEquipe, Ocorrencia } from "@/lib/dominio/efetivoHH";

const ID = "6b1f6f0e-6a0a-4f43-9d8e-2b7a0f1d2c3e";
const form = (p: Partial<FormDados>): FormDados => ({
  tipo: "emprestimo", quantidade: "2", funcao: "Montador", destino: "ana", inicio: "13:00", fim: "", causa: "", emprestimoId: null, ...p,
});
const nada = async () => ({ ok: true as const, dados: undefined });
const nome = (id: string | null) => ({ rita: "Rita", ana: "Ana" })[id ?? ""] ?? "Sem responsável";
const resumo = (p: Partial<HHEquipe> = {}): HHEquipe => ({
  responsavel_id: "rita", pessoas: 6, hhProdutivo: 48, hhParado: 4, hhParadoPorCausa: { material: 4 }, recebidos: [], avisos: [], ...p,
});
const base = {
  responsavelId: "rita", funcoes: ["Montador"], ocorrencias: [] as Ocorrencia[], destinos: [
    { id: "rita", nome: "Rita", ativo: true }, { id: "ana", nome: "Ana", ativo: true },
  ], nome, resumo: resumo(), criar: nada, remover: nada,
};

describe("montarOcorrencia", () => {
  it("Emprestar envia quantidade, função, destino e hora", () => {
    expect(montarOcorrencia(form({}), ID)).toEqual({
      id: ID, tipo: "emprestimo", funcao: "Montador", quantidade: 2, hora_inicio: "13:00", hora_fim: null,
      destino_responsavel_id: "ana", emprestimo_id: null, causa: null,
    });
  });
  it("Emprestar com volta leva o fim", () => {
    expect(montarOcorrencia(form({ fim: "17:00" }), ID)).toMatchObject({ hora_fim: "17:00" });
  });
  it("Parados exige causa e fim", () => {
    expect(montarOcorrencia(form({ tipo: "parado", fim: "15:00" }), ID)).toBe("Informe a causa");
    expect(montarOcorrencia(form({ tipo: "parado", causa: "material" }), ID)).toBe("Informe até que horas ficaram parados");
    expect(montarOcorrencia(form({ tipo: "parado", causa: "material", fim: "15:00" }), ID)).toMatchObject({
      tipo: "parado", causa: "material", hora_fim: "15:00", destino_responsavel_id: null,
    });
  });
  it("Saída sobre empréstimo leva o empréstimo", () => {
    expect(montarOcorrencia(form({ tipo: "saida", emprestimoId: "e1", fim: "x" }), ID)).toMatchObject({
      tipo: "saida", emprestimo_id: "e1", hora_fim: null, destino_responsavel_id: null,
    });
  });
  it("quantidade vazia", () => {
    expect(montarOcorrencia(form({ quantidade: "" }), ID)).toBe("Informe a quantidade");
  });
});

describe("FormOcorrencia", () => {
  it("destino não lista a própria equipe", () => {
    const html = renderToStaticMarkup(
      <FormOcorrencia tipo="emprestimo" responsavelId="rita" funcoes={["Montador"]} destinos={base.destinos} enviar={() => {}} cancelar={() => {}} />,
    );
    expect(html).toContain(">Ana</option>");
    expect(html).not.toContain(">Rita</option>");
    expect(html).toContain("A partir de");
  });
});

describe("OcorrenciasEfetivo", () => {
  it("lista ocorrências e o resumo da equipe", () => {
    const html = renderToStaticMarkup(
      <OcorrenciasEfetivo
        {...base}
        ocorrencias={[{
          id: "o1", responsavel_id: "rita", funcao: "Montador", tipo: "emprestimo", quantidade: 2, hora_inicio: "13:00",
          hora_fim: null, destino_responsavel_id: "ana", emprestimo_id: null, causa: null, created_at: "1",
        }]}
      />,
    );
    expect(html).toContain("2 Montador emprestados → Ana a partir de 13:00");
    expect(html).toContain("6 pessoas · 52,0 HH (4,0 HH parados)");
    expect(html).toContain("+ Emprestar");
  });
  it("recebido oferece só Saída antes e Parados", () => {
    const html = renderToStaticMarkup(
      <OcorrenciasEfetivo
        {...base}
        responsavelId="ana"
        funcoes={[]}
        resumo={resumo({
          responsavel_id: "ana", pessoas: 0, hhProdutivo: 8, hhParado: 0,
          recebidos: [{ emprestimo_id: "o1", de: "rita", funcao: "Montador", quantidade: 2, inicio: "13:00", fim: "17:00" }],
        })}
      />,
    );
    expect(html).toContain("+2 Montador (da Rita, 13:00–17:00)");
    expect(html).toContain("+ Saída antes");
    expect(html).toContain("+ Parados");
    expect(html).not.toContain("Emprestar");
  });
  it("mostra aviso de incoerência", () => {
    const html = renderToStaticMarkup(
      <OcorrenciasEfetivo {...base} resumo={resumo({ avisos: ["Montador: 2 emprestados, mas a linha tem 1"] })} />,
    );
    expect(html).toContain("Montador: 2 emprestados, mas a linha tem 1");
  });
  it("somente leitura: sem botões", () => {
    const html = renderToStaticMarkup(<OcorrenciasEfetivo {...base} somenteLeitura />);
    expect(html).not.toContain("+ Emprestar");
  });
});

describe("Outra função recusa parado", () => {
  it("pareceParado", () => {
    expect(pareceParado("Mecânico parado aguardando peça")).toBe(true);
    expect(pareceParado("Equipe ociosa")).toBe(true);
    expect(pareceParado("Paradista")).toBe(false);
    expect(pareceParado("Pedreiro")).toBe(false);
  });
  it("validarEfetivo recusa linha nova com 'parado'", () => {
    expect(validarEfetivo([{ funcao: "Mecânico parado", quantidade: 2 }], [])).toMatchObject({
      ok: false, erro: "Para gente parada use o botão Parados.",
    });
  });
  it("validarEfetivo aceita linha antiga 'parado' presente em esperado", () => {
    const l = [{ funcao: "Mecânico parado", quantidade: 2 }];
    expect(validarEfetivo(l, l).ok).toBe(true);
  });
});
