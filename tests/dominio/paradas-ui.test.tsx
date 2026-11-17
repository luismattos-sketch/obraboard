import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BotaoTerminei } from "@/components/execucao/BotaoTerminei";
import { FormParada, montarParada, type FormParadaDados } from "@/components/execucao/FormParada";
import { PainelParadas, type PropsPainelParadas } from "@/components/execucao/PainelParadas";
import type { OcorrenciaNaTela } from "@/components/execucao/OcorrenciasEfetivo";

const ID = "6b1f6f0e-6a0a-4f43-9d8e-2b7a0f1d2c3e";
const CARLOS = "0d1c2b3a-4f5e-4a6b-8c7d-9e0f1a2b3c4d";
const form = (p: Partial<FormParadaDados> = {}): FormParadaDados => ({
  quantidade: "2", funcao: "Mecânico", causa: "material", aguardando: "", inicio: "10:40", fim: "", observacao: "", emprestimoId: null, ...p,
});

describe("montarParada", () => {
  it("parada aberta: sem fim", () => {
    expect(montarParada(form({ observacao: " peça " }), ID)).toEqual({
      id: ID, tipo: "parado", funcao: "Mecânico", quantidade: 2, hora_inicio: "10:40", hora_fim: null,
      destino_responsavel_id: null, emprestimo_id: null, causa: "material", observacao: "peça", aguardando_responsavel_id: null,
    });
  });
  it("já voltaram: leva o fim", () => {
    expect(montarParada(form({ fim: "13:15" }), ID)).toMatchObject({ hora_fim: "13:15" });
  });
  it("exige quantidade, função, causa e hora", () => {
    expect(montarParada(form({ quantidade: "" }), ID)).toBe("Informe a quantidade");
    expect(montarParada(form({ funcao: "" }), ID)).toBe("Escolha a função");
    expect(montarParada(form({ causa: "" }), ID)).toBe("Informe a causa");
    expect(montarParada(form({ inicio: "" }), ID)).toBe("Informe desde que horas");
  });
  it("aguardando outra equipe exige a equipe", () => {
    expect(montarParada(form({ causa: "atividade_predecessora" }), ID)).toBe("Escolha a equipe que vocês aguardam");
    expect(montarParada(form({ causa: "atividade_predecessora", aguardando: CARLOS }), ID)).toMatchObject({ aguardando_responsavel_id: CARLOS });
  });
  it("equipe aguardada é descartada se a causa mudou", () => {
    expect(montarParada(form({ causa: "material", aguardando: CARLOS }), ID)).toMatchObject({ aguardando_responsavel_id: null });
  });
});

describe("FormParada", () => {
  it("mostra causas simples com a etiqueta externa e não lista a própria equipe", () => {
    const html = renderToStaticMarkup(
      <FormParada
        responsavelId="joao"
        funcoes={["Mecânico"]}
        destinos={[{ id: "joao", nome: "João", ativo: true }, { id: "carlos", nome: "Carlos", ativo: true }]}
        inicial={{ causa: "atividade_predecessora", inicio: "10:40" }}
        enviar={() => {}}
        cancelar={() => {}}
      />,
    );
    expect(html).toContain("Falta material (externa)");
    expect(html).toContain("Falta de gente</option>");
    expect(html).toContain(">Carlos</option>");
    expect(html).not.toContain(">João</option>");
    expect(html).toContain("Já voltaram às (opcional)");
    expect(html).toContain('type="file"');
  });
});

const aberta = (p: Partial<OcorrenciaNaTela> = {}): OcorrenciaNaTela => ({
  id: "p1", responsavel_id: "joao", funcao: "Mecânico", tipo: "parado", quantidade: 2, hora_inicio: "10:40:00", hora_fim: null,
  destino_responsavel_id: null, emprestimo_id: null, causa: "atividade_predecessora", observacao: "rolamento 6312",
  aguardando_responsavel_id: "carlos", foto_path: null, created_at: "1", ...p,
});
const painel = (p: Partial<PropsPainelParadas> = {}): PropsPainelParadas => ({
  responsavelId: "joao",
  ocorrencias: [aberta()],
  nome: (id) => ({ joao: "João", carlos: "Carlos" })[id ?? ""] ?? "Sem responsável",
  fotos: {},
  estadoFoto: {},
  contexto: { obra: "Caldeira 3", data: "2026-11-16", periodo: "diurno", whatsapp: "5511988887777" },
  funcoes: ["Mecânico"],
  destinos: [{ id: "joao", nome: "João", ativo: true }, { id: "carlos", nome: "Carlos", ativo: true }],
  criar: () => {},
  encerrar: () => {},
  tentarFoto: () => {},
  ...p,
});

describe("PainelParadas", () => {
  it("parada confirmada: descrição, Voltamos a trabalhar e WhatsApp", () => {
    const html = renderToStaticMarkup(<PainelParadas {...painel()} />);
    expect(html).toContain("2 Mecânico parados desde 10:40 · Aguardando outra equipe (Carlos)");
    expect(html).toContain("rolamento 6312");
    expect(html).toContain("Voltamos a trabalhar");
    expect(html).toContain("https://wa.me/5511988887777?text=");
    expect(html).toContain(encodeURIComponent("João: 2 Mecânico parados desde 10:40"));
    expect(html).toContain("⚠ Avisar parada");
  });
  it("parada ainda registrando: sem botões", () => {
    const html = renderToStaticMarkup(<PainelParadas {...painel({ ocorrencias: [aberta({ pendente: true })] })} />);
    expect(html).toContain("Registrando…");
    expect(html).not.toContain("Voltamos a trabalhar");
    expect(html).not.toContain("wa.me");
  });
  it("estado da foto", () => {
    expect(renderToStaticMarkup(<PainelParadas {...painel({ estadoFoto: { p1: "enviando" } })} />)).toContain("Enviando foto…");
    expect(renderToStaticMarkup(<PainelParadas {...painel({ estadoFoto: { p1: "falhou" } })} />)).toContain("Foto não enviada");
    const comFoto = renderToStaticMarkup(
      <PainelParadas {...painel({ ocorrencias: [aberta({ foto_path: "a/b.jpg" })], fotos: { "a/b.jpg": "https://x/y.jpg" } })} />,
    );
    expect(comFoto).toContain('src="https://x/y.jpg"');
  });
  it("Ver tudo (sem responsável): só leitura, sem Avisar parada", () => {
    const html = renderToStaticMarkup(<PainelParadas {...painel({ responsavelId: null, somenteLeitura: true })} />);
    expect(html).toContain("parados desde 10:40");
    expect(html).not.toContain("Avisar parada");
    expect(html).not.toContain("Voltamos a trabalhar");
  });
  it("paradas encerradas e de outras equipes não aparecem", () => {
    const html = renderToStaticMarkup(
      <PainelParadas {...painel({ ocorrencias: [aberta({ hora_fim: "13:00" }), aberta({ id: "p2", responsavel_id: "carlos" })] })} />,
    );
    expect(html).not.toContain("parados desde");
  });
});

describe("BotaoTerminei", () => {
  const props = {
    terminouEm: null as string | null,
    abertasDaEquipe: 0,
    marcar: () => {},
    desfazer: () => {},
    linkWhats: (hora: string) => `https://wa.me/?text=${hora}`,
  };
  it("antes de terminar", () => {
    expect(renderToStaticMarkup(<BotaoTerminei {...props} />)).toContain("✓ Terminei minha parte");
  });
  it("depois de terminar", () => {
    const html = renderToStaticMarkup(<BotaoTerminei {...props} terminouEm="15:20:00" />);
    expect(html).toContain("Você avisou que terminou às 15:20");
    expect(html).toContain("Desfazer");
    expect(html).toContain("https://wa.me/?text=15:20");
  });
});
