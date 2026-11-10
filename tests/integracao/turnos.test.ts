import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarObra } from "@/lib/db/obras";
import { criarTurno, listarTurnos, obterTurnoCompleto } from "@/lib/db/turnos";
import { adicionarAtividade, moverAtividade, trazerPendentes, editarAtividade, removerAtividade } from "@/lib/db/atividades";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

describe.skipIf(!ligado)("turnos e atividades", () => {
  let u: UsuarioTeste;
  let obraId: string;
  beforeAll(async () => {
    u = await criarUsuarioTeste();
    const o = await criarObra(u.cliente, { nome: "Obra T" });
    if (!o.ok) throw new Error(o.erro);
    obraId = o.dados.id;
  });
  afterAll(async () => {
    if (u) await removerUsuarioTeste(u.userId);
  });

  const novoTurno = async (data: string, periodo: "diurno" | "noturno") => {
    const r = await criarTurno(u.cliente, { obra_id: obraId, data, periodo });
    if (!r.ok) throw new Error(r.erro);
    return r.dados;
  };
  const novaAtiv = async (turnoId: string, descricao: string, qtd: number) => {
    const r = await adicionarAtividade(u.cliente, turnoId, { descricao, unidade: "m³", qtd_planejada: qtd });
    if (!r.ok) throw new Error(r.erro);
    return r.dados;
  };

  it("fluxo completo: duplicado, validação, pendentes, mover", { timeout: 60_000 }, async () => {
    const a = await novoTurno("2026-11-07", "noturno");
    const dup1 = await criarTurno(u.cliente, { obra_id: obraId, data: "2026-11-08", periodo: "diurno" });
    expect(dup1.ok).toBe(true);
    const dup2 = await criarTurno(u.cliente, { obra_id: obraId, data: "2026-11-08", periodo: "diurno" });
    expect(dup2).toEqual({ ok: false, erro: "Já existe um turno diurno nesse dia" });
    const b = dup1.ok ? dup1.dados : (undefined as never);

    expect(await adicionarAtividade(u.cliente, a.id, { descricao: "X", unidade: "m", qtd_planejada: 0 })).toEqual({
      ok: false,
      erro: "Quantidade deve ser maior que zero",
    });

    // primeiro turno: sem anterior
    expect(await trazerPendentes(u.cliente, a.id)).toEqual({ ok: false, erro: "Não há turno anterior nesta obra" });

    const x = await novaAtiv(a.id, "X", 10);
    const y = await novaAtiv(a.id, "Y", 5);
    const z = await novaAtiv(a.id, "Z", 3);
    expect(typeof x.qtd_planejada).toBe("number");
    await editarAtividade(u.cliente, x.id, { qtd_realizada: 4 });
    await editarAtividade(u.cliente, y.id, { qtd_realizada: 5 });

    const r = await trazerPendentes(u.cliente, b.id);
    expect(r).toEqual({ ok: true, dados: { adicionadas: 2 } });
    const cb = await obterTurnoCompleto(u.cliente, b.id);
    expect(cb!.atividades.map((t) => [t.descricao, t.qtd_planejada])).toEqual([["X", 6], ["Z", 3]]);
    expect(cb!.atividades.map((t) => t.origem_id)).toEqual([x.id, z.id]);
    expect(cb!.atividades.every((t) => t.qtd_realizada === null && t.causa === null)).toBe(true);

    expect(await trazerPendentes(u.cliente, b.id)).toEqual({ ok: true, dados: { adicionadas: 0 } });
    expect((await obterTurnoCompleto(u.cliente, b.id))!.atividades).toHaveLength(2);

    const zb = cb!.atividades[1];
    expect((await moverAtividade(u.cliente, zb.id, "cima")).ok).toBe(true);
    expect((await obterTurnoCompleto(u.cliente, b.id))!.atividades.map((t) => t.descricao)).toEqual(["Z", "X"]);
    expect((await moverAtividade(u.cliente, zb.id, "cima")).ok).toBe(true); // borda

    const lista = await listarTurnos(u.cliente, obraId);
    expect(lista.map((t) => t.id)).toEqual([b.id, a.id]);

    // turno fechado bloqueia edição
    // (com causa informada: o trigger causa_pendente recusa fechar com atividade sem causa)
    await u.cliente.from("atividades").update({ causa: "material" }).eq("turno_id", b.id);
    const { error: ef } = await u.cliente.from("turnos").update({ status: "fechado" }).eq("id", b.id);
    expect(ef).toBeNull();
    expect(await removerAtividade(u.cliente, zb.id)).toEqual({ ok: false, erro: "Turno fechado: reabra para editar" });
  });

  it("mover com lacunas de ordem (após remoções) mantém a sequência esperada", { timeout: 60_000 }, async () => {
    const t = await novoTurno("2026-12-01", "diurno");
    const [a, b, , d, e] = [
      await novaAtiv(t.id, "A", 1),
      await novaAtiv(t.id, "B", 1),
      await novaAtiv(t.id, "C", 1),
      await novaAtiv(t.id, "D", 1),
      await novaAtiv(t.id, "E", 1),
    ];
    expect((await removerAtividade(u.cliente, a.id)).ok).toBe(true);
    expect((await removerAtividade(u.cliente, b.id)).ok).toBe(true);
    expect((await moverAtividade(u.cliente, e.id, "cima")).ok).toBe(true);
    expect((await obterTurnoCompleto(u.cliente, t.id))!.atividades.map((x) => x.descricao)).toEqual(["C", "E", "D"]);
    expect((await moverAtividade(u.cliente, d.id, "cima")).ok).toBe(true);
    expect((await obterTurnoCompleto(u.cliente, t.id))!.atividades.map((x) => x.descricao)).toEqual(["C", "D", "E"]);
  });

  it("obterTurnoCompleto devolve null para id inválido ou inexistente", async () => {
    expect(await obterTurnoCompleto(u.cliente, "nao-e-uuid")).toBeNull();
    expect(await obterTurnoCompleto(u.cliente, crypto.randomUUID())).toBeNull();
  });
});
