import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarObra, editarIntervalosObra, obterIntervalosObra } from "@/lib/db/obras";
import { criarTurno } from "@/lib/db/turnos";
import { salvarIntervaloTurno } from "@/lib/db/execucao";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

describe.skipIf(!ligado)("intervalo de refeição", () => {
  let u: UsuarioTeste;
  beforeAll(async () => {
    u = await criarUsuarioTeste();
  });
  afterAll(async () => {
    if (u) await removerUsuarioTeste(u.userId);
  });

  async function obraETurno(data: string) {
    const o = await criarObra(u.cliente, { nome: "Obra Intervalo" });
    if (!o.ok) throw new Error(o.erro);
    const t = await criarTurno(u.cliente, { obra_id: o.dados.id, data, periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00" });
    if (!t.ok) throw new Error(t.erro);
    return { obraId: o.dados.id, turnoId: t.dados.id };
  }
  const intervaloDe = async (turnoId: string) =>
    (await u.cliente.from("turnos").select("intervalo_inicio, intervalo_fim").eq("id", turnoId).single()).data;

  it("editar intervalo da obra não altera turno existente; turno novo usa o novo", { timeout: 60_000 }, async () => {
    const c = await obraETurno("2026-11-17");
    const r = await editarIntervalosObra(u.cliente, c.obraId, { diurno: { inicio: "11:30", fim: "12:30" }, noturno: null });
    expect(r.ok).toBe(true);
    expect(await obterIntervalosObra(u.cliente, c.obraId)).toEqual({ diurno: { inicio: "11:30", fim: "12:30" }, noturno: null });
    expect(await intervaloDe(c.turnoId)).toEqual({ intervalo_inicio: "12:00:00", intervalo_fim: "13:00:00" });
    const t2 = await criarTurno(u.cliente, { obra_id: c.obraId, data: "2026-11-18", periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00" });
    if (!t2.ok) throw new Error(t2.erro);
    expect(await intervaloDe(t2.dados.id)).toEqual({ intervalo_inicio: "11:30:00", intervalo_fim: "12:30:00" });
    const t3 = await criarTurno(u.cliente, { obra_id: c.obraId, data: "2026-11-18", periodo: "noturno", hora_inicio_prevista: "22:00", hora_fim_prevista: "06:00" });
    if (!t3.ok) throw new Error(t3.erro);
    expect(await intervaloDe(t3.dados.id)).toEqual({ intervalo_inicio: null, intervalo_fim: null });
  });

  it("salvarIntervaloTurno troca e zera", { timeout: 60_000 }, async () => {
    const c = await obraETurno("2026-11-19");
    expect((await salvarIntervaloTurno(u.cliente, c.turnoId, { inicio: "12:30", fim: "13:30" })).ok).toBe(true);
    expect(await intervaloDe(c.turnoId)).toEqual({ intervalo_inicio: "12:30:00", intervalo_fim: "13:30:00" });
    expect((await salvarIntervaloTurno(u.cliente, c.turnoId, null)).ok).toBe(true);
    expect(await intervaloDe(c.turnoId)).toEqual({ intervalo_inicio: null, intervalo_fim: null });
  });

  it("intervalo invertido no diurno é recusado", { timeout: 60_000 }, async () => {
    const c = await obraETurno("2026-11-20");
    expect(await salvarIntervaloTurno(u.cliente, c.turnoId, { inicio: "13:00", fim: "12:00" })).toMatchObject({ ok: false });
    expect(await editarIntervalosObra(u.cliente, c.obraId, { diurno: { inicio: "13:00", fim: "12:00" }, noturno: null })).toMatchObject({ ok: false });
  });
});
