import { afterEach, describe, expect, it, vi } from "vitest";
import { iaLigada, interpretarRelato } from "@/lib/ia/cliente";
import type { AtividadeParaIA } from "@/lib/ia/esquema";

const tubo: AtividadeParaIA = { codigo: "A1", descricao: "Tubulação linha 3", local: null, unidade: "m", meta: 50, feito: null, tipo: null };
const suporte: AtividadeParaIA = { codigo: "A2", descricao: "Suporte de tubo", local: null, unidade: "un", meta: 8, feito: 40, tipo: null };

afterEach(() => vi.unstubAllEnvs());

describe("iaLigada", () => {
  it("desligada sem chave e sem modo falso", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("FRENTIA_IA_FALSA", "");
    expect(iaLigada()).toBe(false);
  });
  it("ligada com a chave ou com o modo falso", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-teste");
    expect(iaLigada()).toBe(true);
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("FRENTIA_IA_FALSA", "1");
    expect(iaLigada()).toBe(true);
  });
});

describe("interpretarRelato com FRENTIA_IA_FALSA", () => {
  it("lê número, atividade e a causa ambígua do andaime", async () => {
    vi.stubEnv("FRENTIA_IA_FALSA", "1");
    const r = await interpretarRelato("fizemos 30 m de tubulação, faltou andaime", [tubo, suporte]);
    expect(r).toEqual({
      ok: true,
      resposta: {
        itens: [
          {
            atividade: "A1", candidatas: [], quantidade: 30, unidade_dita: "m", modo: "total", concluida: false,
            causa: null, causas_candidatas: ["material", "equipamento"], coisa_da_causa: "andaime", trecho: "faltou andaime",
          },
        ],
      },
    });
  });

  it("modo incerto quando já havia lançamento", async () => {
    vi.stubEnv("FRENTIA_IA_FALSA", "1");
    const r = await interpretarRelato("fizemos 30 m de suporte", [tubo, suporte]);
    expect(r.ok && r.resposta.itens[0]).toMatchObject({ atividade: "A2", quantidade: 30, modo: "incerto" });
  });

  it("texto com ERRO simula IA fora do ar", async () => {
    vi.stubEnv("FRENTIA_IA_FALSA", "1");
    expect(await interpretarRelato("ERRO", [tubo])).toEqual({ ok: false, motivo: "indisponivel" });
  });

  it("sem nada reconhecível devolve lista vazia", async () => {
    vi.stubEnv("FRENTIA_IA_FALSA", "1");
    expect(await interpretarRelato("bom dia", [tubo])).toEqual({ ok: true, resposta: { itens: [] } });
  });
});
