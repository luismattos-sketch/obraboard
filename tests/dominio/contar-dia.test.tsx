import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContarDia, PreviaRelato } from "@/components/execucao/ContarDia";
import { executarLancamento } from "@/components/execucao/lancarRelato";
import { conferirRelato, type AtividadeRelato } from "@/lib/dominio/relato";
import type { ItemIA } from "@/lib/ia/esquema";
import type { DadosExecucao } from "@/lib/dominio/tipos";
import type { EstadoPendente } from "@/components/execucao/rastreioSalvamento";

const T: AtividadeRelato = { id: "t", descricao: "Tubulação linha 3", local: null, unidade: "m", qtd_planejada: 50, qtd_realizada: null, causa: null, observacao: null, tipo: null };
const S: AtividadeRelato = { ...T, id: "s", descricao: "Suporte de tubo", unidade: "un", qtd_planejada: 8 };
const andaime: ItemIA = {
  atividade: "A1", candidatas: [], quantidade: 30, unidade_dita: "m", modo: "total", concluida: false,
  causa: null, causas_candidatas: ["material", "equipamento"], coisa_da_causa: "andaime", trecho: "faltou andaime",
};
const nada = async () => ({ ok: true as const, dados: undefined });

describe("ContarDia (estado inicial)", () => {
  it("título, texto guardado e dica do microfone", () => {
    const html = renderToStaticMarkup(
      <ContarDia textoInicial="fizemos 30 m" relatoIdInicial="r1" organizar={async () => ({ ok: false, erro: "x" })}
        salvar={async () => ({ ok: true, dados: { qtd_realizada: 1, causa: null, observacao: null } })} marcarLancado={nada} aoLancar={() => {}} />,
    );
    expect(html).toContain("Conte como foi o dia");
    expect(html).toContain(">fizemos 30 m</textarea>");
    expect(html).toContain("Dá para ditar pelo microfone do teclado.");
    expect(html).toContain("Organizar");
  });
});

describe("PreviaRelato", () => {
  const previa = conferirRelato({ itens: [andaime] }, [T, S]);

  it("mostra o que entendeu, a pergunta e quem não foi citado; Lançar travado", () => {
    const html = renderToStaticMarkup(<PreviaRelato previa={previa} respostas={{}} resultados={{}} responder={() => {}} />);
    expect(html).toContain("A IA entendeu:");
    expect(html).toContain("Tubulação linha 3 — 0 → 30 m de 50 m (parcial)");
    expect(html).toContain("Andaime é…");
    expect(html).toContain(">Falta material</button>");
    expect(html).toContain("Suporte de tubo — você não falou nada (fica como está)");
  });

  it("resposta escolhida fica marcada", () => {
    const html = renderToStaticMarkup(
      <PreviaRelato previa={previa} respostas={{ [previa.perguntas[0].chave]: "material" }} resultados={{}} responder={() => {}} />,
    );
    expect(html).toMatch(/aria-pressed="true"[^>]*>Falta material<\/button>/);
  });

  it("item que não vai ser lançado depois da resposta aparece com o motivo", () => {
    const p = conferirRelato({ itens: [{ ...andaime, atividade: null, candidatas: ["A1", "A2"], causas_candidatas: [], trecho: null }] }, [T, S]);
    const html = renderToStaticMarkup(<PreviaRelato previa={p} respostas={{ [p.perguntas[0].chave]: "s" }} resultados={{}} responder={() => {}} />);
    expect(html).toContain("Não vai ser lançado: Suporte de tubo: unidade diferente (m, a atividade é em un) — complete no card");
  });

  it("faltas, resultado do lançamento e nada para lançar", () => {
    const comFalta = conferirRelato({ itens: [{ ...andaime, atividade: "A9" }] }, [T]);
    expect(renderToStaticMarkup(<PreviaRelato previa={comFalta} respostas={{}} resultados={{}} responder={() => {}} />))
      .toContain("Falta: Não achei a atividade citada — complete no card");
    const html = renderToStaticMarkup(<PreviaRelato previa={previa} respostas={{}} resultados={{ t: "mudou" }} responder={() => {}} />);
    expect(html).toContain("mudou desde a prévia — organize de novo");
    const vazio = conferirRelato({ itens: [] }, [T]);
    expect(renderToStaticMarkup(<PreviaRelato previa={vazio} respostas={{}} resultados={{}} responder={() => {}} />))
      .toContain("Não achei nada para lançar — escreva o que foi feito.");
  });
});

describe("executarLancamento", () => {
  const g = (id: string) => ({ atividadeId: id, dados: { qtd_realizada: 30, causa: null, observacao: null } as DadosExecucao, esperado: { qtd_realizada: null, causa: null, observacao: null } as DadosExecucao });
  const sem = () => {};

  it("grava cada item com o esperado e devolve ok", async () => {
    const chamadas: [string, DadosExecucao, DadosExecucao][] = [];
    const r = await executarLancamento([g("t"), g("s")], async (id, d, e) => {
      chamadas.push([id, d, e]);
      return { ok: true, dados: d };
    }, { registrar: sem, esperar: async () => {}, online: () => true });
    expect(r).toEqual({ t: "ok", s: "ok" });
    expect(chamadas.map((c) => c[0])).toEqual(["t", "s"]);
    expect(chamadas[0][2]).toEqual({ qtd_realizada: null, causa: null, observacao: null });
  });

  it("conflito vira 'mudou'; outro erro vira a mensagem; os demais seguem", async () => {
    const r = await executarLancamento([g("t"), g("s"), g("x")], async (id) => {
      if (id === "t") return { ok: false, erro: "mudou", conflito: {} };
      if (id === "s") return { ok: false, erro: "Esta atividade foi removida pelo planejador. Recarregue a página." };
      return { ok: true, dados: { qtd_realizada: 30, causa: null, observacao: null } };
    }, { registrar: sem, esperar: async () => {}, online: () => true });
    expect(r).toEqual({ t: "mudou", s: "Esta atividade foi removida pelo planejador. Recarregue a página.", x: "ok" });
  });

  it("sem rede: registra 'falhou', espera conforme a política e tenta de novo", async () => {
    const estados: (EstadoPendente | null)[] = [];
    const esperas: number[] = [];
    let n = 0;
    const r = await executarLancamento([g("t")], async (_id, d) => {
      n++;
      if (n < 3) throw new Error("rede");
      return { ok: true, dados: d };
    }, { registrar: (_id, e) => estados.push(e), esperar: async (ms) => void esperas.push(ms), online: () => true });
    expect(r).toEqual({ t: "ok" });
    expect(esperas).toEqual([5000, 10000]);
    expect(estados).toEqual(["salvando", "falhou", "falhou", null]);
  });
});
