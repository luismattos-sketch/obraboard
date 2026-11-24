import { describe, expect, it } from "vitest";
import type { Ocorrencia } from "@/lib/dominio/efetivoHH";
import { linkWhatsapp, mensagemParada, mensagemRetomada, mensagemExtra, mensagemTerminou, normalizarWhatsapp, mensagemCobranca } from "@/lib/dominio/whatsapp";

const parada = (p: Partial<Ocorrencia> = {}): Ocorrencia => ({
  id: "p1", responsavel_id: "joao", funcao: "Mecânico", tipo: "parado", quantidade: 2, hora_inicio: "10:40:00", hora_fim: null,
  destino_responsavel_id: null, emprestimo_id: null, causa: "atividade_predecessora", observacao: "rolamento 6312",
  aguardando_responsavel_id: "carlos", created_at: "", ...p,
});
const ctx = { obra: "Caldeira 3", data: "2026-11-16", periodo: "diurno" as const, equipe: "João" };

describe("normalizarWhatsapp", () => {
  it("aceita formatos comuns e completa o DDI", () => {
    expect(normalizarWhatsapp("(11) 98888-7777")).toEqual({ ok: true, dados: "5511988887777" });
    expect(normalizarWhatsapp("+55 11 98888-7777")).toEqual({ ok: true, dados: "5511988887777" });
    expect(normalizarWhatsapp("11 3333-4444")).toEqual({ ok: true, dados: "551133334444" });
  });
  it("vazio = sem número", () => {
    expect(normalizarWhatsapp("  ")).toEqual({ ok: true, dados: null });
  });
  it("curto demais", () => {
    expect(normalizarWhatsapp("123")).toEqual({ ok: false, erro: "Número inválido (ex.: (11) 98888-7777)" });
  });
});

describe("linkWhatsapp", () => {
  it("com e sem número", () => {
    expect(linkWhatsapp("5511988887777", "a b")).toBe("https://wa.me/5511988887777?text=a%20b");
    expect(linkWhatsapp(null, "a b")).toBe("https://wa.me/?text=a%20b");
  });
});

describe("mensagens", () => {
  it("parada com equipe aguardada e observação", () => {
    expect(mensagemParada({ ...ctx, o: parada(), aguardando: "Carlos" })).toBe(
      "⚠ Parada — Caldeira 3 · 16/11 Diurno\nJoão: 2 Mecânicos parados desde 10:40\nMotivo: Aguardando outra equipe (Carlos)\nrolamento 6312",
    );
  });
  it("parada sem aguardando nem observação", () => {
    expect(mensagemParada({ ...ctx, o: parada({ causa: "material", observacao: null, aguardando_responsavel_id: null }), aguardando: null })).toBe(
      "⚠ Parada — Caldeira 3 · 16/11 Diurno\nJoão: 2 Mecânicos parados desde 10:40\nMotivo: Falta material",
    );
  });
  it("uma pessoa: singular", () => {
    expect(mensagemParada({ ...ctx, o: parada({ quantidade: 1, observacao: null }), aguardando: "Carlos" })).toContain("João: 1 Mecânico parado desde 10:40");
  });
  it("retomada", () => {
    expect(mensagemRetomada({ ...ctx, o: parada({ hora_fim: "13:15:00" }) })).toBe(
      "✅ João: 2 Mecânicos voltaram às 13:15 (parados desde 10:40) — Caldeira 3 · 16/11 Diurno",
    );
  });
  it("terminou", () => {
    expect(mensagemTerminou({ ...ctx, hora: "15:20" })).toBe("✓ João terminou a parte da equipe às 15:20 — Caldeira 3 · 16/11 Diurno");
  });
});

describe("mensagemExtra", () => {
  it("extra com quantidade", () => {
    const ctx = { obra: "Caldeira 3", data: "2026-11-16", periodo: "diurno" as const, equipe: "Carlos" };
    expect(mensagemExtra({ ...ctx, descricao: "Troca de iluminação", qtd: 12.5, unidade: "un" })).toBe(
      "➕ Extra — Caldeira 3 · 16/11 Diurno\nCarlos: Troca de iluminação — 12,5 un",
    );
  });
});

describe("mensagemCobranca", () => {
  const faltas = [
    { tipo: "sem_lancamento" as const, atividadeId: "a1", texto: "Montagem — lançar quanto foi feito" },
    { tipo: "terminei" as const, atividadeId: null, texto: "Não apertou \"Terminei minha parte\"" },
  ];
  const p = { obra: "Caldeira 3", data: "2026-11-23", periodo: "diurno" as const, nome: "João", faltas };
  it("lista o que falta e manda o link do responsável", () => {
    expect(mensagemCobranca({ ...p, link: "https://x/t/tok?r=joao" })).toBe(
      "Oi, João! Falta completar no Frentia — Caldeira 3 · 23/11 Diurno:\n• Montagem: lançar quanto foi feito\n• Não apertou \"Terminei minha parte\"\nAbra aqui: https://x/t/tok?r=joao",
    );
  });
  it("sem link, sem a linha Abra aqui", () => {
    expect(mensagemCobranca({ ...p, link: null }).split("\n")).toHaveLength(3);
  });
});
