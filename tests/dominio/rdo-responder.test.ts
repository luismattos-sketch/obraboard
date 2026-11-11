import { describe, expect, it } from "vitest";
import type { TurnoCompleto } from "@/lib/db/turnos";
import { respostaPdf } from "@/lib/rdo/responder";

const turno = {
  id: "t", obra_id: "o", data: "2026-11-08", periodo: "diurno",
  hora_inicio_prevista: null, hora_fim_prevista: null, hora_inicio_real: null, hora_fim_real: null,
  status: "enviado", token_hash: null, enviado_em: null, fechado_em: null,
  obra: { id: "o", empresa_id: "e", nome: "Obra", cliente: null, endereco: null, created_at: "" },
  atividades: [], efetivo: [], clima: [],
} as unknown as TurnoCompleto;

describe("respostaPdf", () => {
  it("devolve o PDF como anexo, sem cache", async () => {
    const r = await respostaPdf(turno, { tipo: "rascunho", geradoEm: new Date() }, "RDO-obra-2026-11-08-diurno-rascunho.pdf");
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Type")).toBe("application/pdf");
    expect(r.headers.get("Content-Disposition")).toBe('attachment; filename="RDO-obra-2026-11-08-diurno-rascunho.pdf"');
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(Buffer.from(await r.arrayBuffer()).subarray(0, 4).toString("latin1")).toBe("%PDF");
  }, 30000);
});
