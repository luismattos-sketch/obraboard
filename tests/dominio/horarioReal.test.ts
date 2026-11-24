import { describe, expect, it } from "vitest";
import { horarioRealDasEquipes, lerIniciados } from "@/lib/dominio/efetivoHH";

const vazio = { iniciados: [], terminados: [], equipes: [] };

describe("horarioRealDasEquipes", () => {
  it("nenhum iniciado: sem início nem fim", () => {
    expect(horarioRealDasEquipes(vazio)).toEqual({ hora_inicio_real: null, hora_fim_real: null });
  });

  it("início é o do primeiro toque, não o menor horário", () => {
    const r = horarioRealDasEquipes({
      ...vazio,
      iniciados: [
        { iniciou_em: "06:58:00", created_at: "2026-11-23T10:05:00Z" },
        { iniciou_em: "07:12:00", created_at: "2026-11-23T10:00:00Z" },
      ],
    });
    expect(r.hora_inicio_real).toBe("07:12");
  });

  it("noturno: fim é o do último toque (passa da meia-noite)", () => {
    const r = horarioRealDasEquipes({
      iniciados: [{ iniciou_em: "19:05:00", created_at: "2026-11-23T22:05:00Z" }],
      terminados: [
        { responsavel_id: "A", terminou_em: "04:40:00", created_at: "2026-11-24T07:40:00Z" },
        { responsavel_id: "B", terminou_em: "00:30:00", created_at: "2026-11-24T03:30:00Z" },
      ],
      equipes: ["A", "B"],
    });
    expect(r).toEqual({ hora_inicio_real: "19:05", hora_fim_real: "04:40" });
  });

  it("fim só quando todas as equipes terminaram", () => {
    const r = horarioRealDasEquipes({
      iniciados: [{ iniciou_em: "07:00:00", created_at: "2026-11-23T10:00:00Z" }],
      terminados: [{ responsavel_id: "A", terminou_em: "16:00:00", created_at: "2026-11-23T19:00:00Z" }],
      equipes: ["A", "B"],
    });
    expect(r.hora_fim_real).toBeNull();
  });

  it("sem equipes: sem fim", () => {
    const r = horarioRealDasEquipes({
      ...vazio,
      terminados: [{ responsavel_id: "A", terminou_em: "16:00:00", created_at: "2026-11-23T19:00:00Z" }],
    });
    expect(r.hora_fim_real).toBeNull();
  });
});

describe("lerIniciados", () => {
  it("ausente = nenhum; ordena por horário", () => {
    expect(lerIniciados(null)).toEqual([]);
    expect(lerIniciados([{ responsavel_id: "b", iniciou_em: "07:30:00" }, { responsavel_id: "a", iniciou_em: "07:10:00" }])).toEqual([
      { responsavel_id: "a", iniciou_em: "07:10:00" },
      { responsavel_id: "b", iniciou_em: "07:30:00" },
    ]);
  });
});
