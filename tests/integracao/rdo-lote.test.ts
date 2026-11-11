import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { adicionarAtividade } from "@/lib/db/atividades";
import { salvarExecucaoPlanejador } from "@/lib/db/execucao";
import { criarObra } from "@/lib/db/obras";
import { aplicarAcao, criarTurno } from "@/lib/db/turnos";
import { respostaLote } from "@/lib/rdo/lote";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

describe.skipIf(!ligado)("PDF único do mês", () => {
  let u: UsuarioTeste;
  let outro: UsuarioTeste;
  let obraId: string;
  beforeAll(async () => {
    u = await criarUsuarioTeste();
    outro = await criarUsuarioTeste();
    const exigir = <T,>(r: { ok: true; dados: T } | { ok: false; erro: string }): T => {
      if (!r.ok) throw new Error(r.erro);
      return r.dados;
    };
    obraId = exigir(await criarObra(u.cliente, { nome: "Obra Lote" })).id;
    for (const data of ["2026-11-05", "2026-11-06"]) {
      const t = exigir(await criarTurno(u.cliente, {
        obra_id: obraId, data, periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "16:00",
      }));
      const at = exigir(await adicionarAtividade(u.cliente, t.id, { descricao: "Alvenaria", unidade: "m²", qtd_planejada: 10 }));
      exigir(await aplicarAcao(u.cliente, t.id, "liberar"));
      exigir(await salvarExecucaoPlanejador(u.cliente, t.id, at.id, { qtd_realizada: 10, causa: null, observacao: null }));
      exigir(await aplicarAcao(u.cliente, t.id, "fechar"));
      if (data === "2026-11-06") {
        exigir(await aplicarAcao(u.cliente, t.id, "reabrir", { motivo: "Correção de teste" }));
        exigir(await aplicarAcao(u.cliente, t.id, "fechar"));
      }
    }
  }, 90_000);
  afterAll(async () => {
    if (u) await removerUsuarioTeste(u.userId);
    if (outro) await removerUsuarioTeste(outro.userId);
  });

  it("gera o PDF do mês", async () => {
    const r = await respostaLote(u.cliente, "2026-11", obraId);
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Type")).toBe("application/pdf");
    expect(r.headers.get("Content-Disposition")).toBe('attachment; filename="RDOs-obra-lote-2026-11.pdf"');
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    const pdf = await PDFDocument.load(new Uint8Array(await r.arrayBuffer()));
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(3);
    expect(pdf.getTitle()).toBe("RDOs — Obra Lote — novembro de 2026");
  }, 60_000);

  it("todas as obras", async () => {
    const r = await respostaLote(u.cliente, "2026-11", null);
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Disposition")).toBe('attachment; filename="RDOs-todas-as-obras-2026-11.pdf"');
  }, 60_000);

  it("sem mês ou obra inválida", async () => {
    const r = await respostaLote(u.cliente, null, null);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ erro: "Escolha um mês" });
    expect((await respostaLote(u.cliente, "2026-11", "abc")).status).toBe(400);
  });

  it("mês vazio", async () => {
    const r = await respostaLote(u.cliente, "2026-01", obraId);
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ erro: "Nenhum RDO neste filtro" });
  });

  it("outra empresa não enxerga", async () => {
    expect((await respostaLote(outro.cliente, "2026-11", obraId)).status).toBe(404);
  });
});
