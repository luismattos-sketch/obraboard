import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OQueFalta } from "@/app/(app)/obras/[obraId]/turnos/[turnoId]/OQueFalta";
import type { GrupoFaltas } from "@/lib/dominio/faltas";

const falta = { tipo: "sem_lancamento" as const, atividadeId: "a1", texto: "Montagem — lançar quanto foi feito" };
const props = (grupos: GrupoFaltas[], telefone: string | null = "(11) 98888-7777", token: string | null = "tok") => ({
  grupos,
  responsaveis: [{ id: "joao", nome: "João", telefone }],
  contexto: { obra: "Caldeira 3", data: "2026-11-23", periodo: "diurno" as const },
  token, fim: "2026-11-23 17:00", enviado: false, terminados: [],
});
const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));

describe("OQueFalta", () => {
  it("sem faltas: Nada faltando", () => {
    const html = renderToStaticMarkup(<OQueFalta {...props([{ responsavelId: "joao", horaDeCobrar: true, faltas: [] }])} />);
    expect(html).toContain("Nada faltando ✓");
    expect(html).not.toContain("Cobrar no WhatsApp");
  });

  it("cobra no número do responsável com o link dele", () => {
    const html = renderToStaticMarkup(<OQueFalta {...props([{ responsavelId: "joao", horaDeCobrar: true, faltas: [falta] }])} />);
    const [href] = hrefs(html);
    expect(href.startsWith("https://wa.me/5511988887777?text=")).toBe(true);
    expect(decodeURIComponent(href.split("text=")[1])).toContain("/t/tok?r=joao");
    expect(html).toContain("já devia ter fechado (fim 17:00)");
    expect(html).toContain('aria-label="Ir para: Montagem"');
  });

  it("sem telefone: wa.me sem número e dica; sem link: dica", () => {
    const html = renderToStaticMarkup(<OQueFalta {...props([{ responsavelId: "joao", horaDeCobrar: false, faltas: [falta] }], null, null)} />);
    expect(hrefs(html)[0].startsWith("https://wa.me/?text=")).toBe(true);
    expect(html).toContain("Cadastre o telefone");
    expect(html).toContain("Gere o link de campo");
    expect(html).toContain("em andamento");
  });

  it("sem responsável: sem botão de cobrar", () => {
    const html = renderToStaticMarkup(<OQueFalta {...props([{ responsavelId: null, horaDeCobrar: false, faltas: [falta] }])} />);
    expect(html).toContain("Sem responsável");
    expect(html).not.toContain("Cobrar no WhatsApp");
  });
});
