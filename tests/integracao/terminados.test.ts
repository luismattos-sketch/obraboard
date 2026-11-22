import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adicionarAtividade } from "@/lib/db/atividades";
import { ERRO_CAUSA_TERMINEI, ERRO_FECHADO_CAMPO } from "@/lib/db/mensagens";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarObra, editarWhatsappObra } from "@/lib/db/obras";
import { desfazerTerminouCampo, marcarTerminouCampo } from "@/lib/db/terminados";
import { aplicarAcao, criarTurno, obterTurnoCompleto } from "@/lib/db/turnos";
import { salvarExecucaoPlanejador } from "@/lib/db/execucao";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, VAZIO, type UsuarioTeste } from "./ajuda";

describe.skipIf(!ligado)("terminei minha parte e whatsapp da obra", () => {
  let u: UsuarioTeste;
  beforeAll(async () => {
    u = await criarUsuarioTeste();
  });
  afterAll(async () => {
    if (u) await removerUsuarioTeste(u.userId);
  });

  async function cenario() {
    const o = await criarObra(u.cliente, { nome: "Obra Terminei" });
    if (!o.ok) throw new Error(o.erro);
    const t = await criarTurno(u.cliente, {
      obra_id: o.dados.id, data: "2026-11-16", periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00",
    });
    if (!t.ok) throw new Error(t.erro);
    const a = await adicionarAtividade(u.cliente, t.dados.id, { descricao: "Bomba", unidade: "un", qtd_planejada: 1 });
    if (!a.ok) throw new Error(a.erro);
    const { data: r } = await u.cliente.from("responsaveis").insert({ obra_id: o.dados.id, nome: "Ana" }).select("id").single();
    const { data: j } = await u.cliente.from("responsaveis").insert({ obra_id: o.dados.id, nome: "João" }).select("id").single();
    const b = await adicionarAtividade(u.cliente, t.dados.id, { descricao: "Tubo", unidade: "tubo", qtd_planejada: 8 });
    if (!b.ok) throw new Error(b.erro);
    await criarClienteAdmin().from("atividades").update({ responsavel_id: r!.id }).eq("id", a.dados.id);
    await criarClienteAdmin().from("atividades").update({ responsavel_id: j!.id }).eq("id", b.dados.id);
    const l = await aplicarAcao(u.cliente, t.dados.id, "liberar");
    if (!l.ok || !l.dados.token) throw new Error("liberar");
    return { obraId: o.dados.id, turnoId: t.dados.id, atividadeId: a.dados.id, daJoao: b.dados.id, token: l.dados.token, ana: r!.id as string };
  }

  async function lancar(c: { turnoId: string }, id: string, d: Partial<typeof VAZIO> & { qtd_realizada: number | null }) {
    const e = await salvarExecucaoPlanejador(u.cliente, c.turnoId, id, { causa: null, observacao: null, ...d }, VAZIO);
    if (!e.ok) throw new Error(e.erro);
  }

  it("atividade da equipe sem causa: recusa e não grava", { timeout: 60_000 }, async () => {
    const c = await cenario();
    expect(await marcarTerminouCampo(c.token, c.ana, "15:20")).toEqual({ ok: false, erro: ERRO_CAUSA_TERMINEI });
    expect((await obterTurnoCompleto(u.cliente, c.turnoId))?.terminados).toEqual([]);
  });

  it("Outro sem observação recusa; com observação aceita", { timeout: 60_000 }, async () => {
    const c = await cenario();
    await lancar(c, c.atividadeId, { qtd_realizada: 0, causa: "outro" });
    expect((await marcarTerminouCampo(c.token, c.ana, "15:20")).ok).toBe(false);
    const { error } = await criarClienteAdmin().from("atividades").update({ observacao: "chuva de pó" }).eq("id", c.atividadeId);
    if (error) throw new Error(error.message);
    expect((await marcarTerminouCampo(c.token, c.ana, "15:20")).ok).toBe(true);
  });

  it("causa faltando de outra equipe não trava", { timeout: 60_000 }, async () => {
    const c = await cenario();
    await lancar(c, c.atividadeId, { qtd_realizada: 1 });
    expect((await marcarTerminouCampo(c.token, c.ana, "15:20")).ok).toBe(true);
  });

  it("marcar, repetir (uma linha só) e desfazer", { timeout: 60_000 }, async () => {
    const c = await cenario();
    await lancar(c, c.atividadeId, { qtd_realizada: 1 });
    expect(await marcarTerminouCampo(c.token, c.ana, "15:20")).toEqual({ ok: true, dados: undefined });
    expect(await marcarTerminouCampo(c.token, c.ana, "15:20")).toEqual({ ok: true, dados: undefined });
    expect((await obterTurnoCompleto(u.cliente, c.turnoId))?.terminados).toEqual([{ responsavel_id: c.ana, terminou_em: "15:20:00" }]);
    expect((await desfazerTerminouCampo(c.token, c.ana)).ok).toBe(true);
    expect((await obterTurnoCompleto(u.cliente, c.turnoId))?.terminados).toEqual([]);
  });

  it("hora inválida é recusada", { timeout: 60_000 }, async () => {
    const c = await cenario();
    expect((await marcarTerminouCampo(c.token, c.ana, "25:00")).ok).toBe(false);
  });

  it("turno fechado recusa", { timeout: 60_000 }, async () => {
    const c = await cenario();
    await lancar(c, c.atividadeId, { qtd_realizada: 1 });
    await lancar(c, c.daJoao, { qtd_realizada: 8 });
    const f = await aplicarAcao(u.cliente, c.turnoId, "fechar");
    if (!f.ok) throw new Error(f.erro);
    expect(await marcarTerminouCampo(c.token, c.ana, "15:20")).toMatchObject({ ok: false });
    expect(await desfazerTerminouCampo(c.token, c.ana)).toMatchObject({ ok: false });
    void ERRO_FECHADO_CAMPO;
  });

  it("whatsapp do planejador: salvar, ler e recusar inválido", { timeout: 60_000 }, async () => {
    const c = await cenario();
    expect((await editarWhatsappObra(u.cliente, c.obraId, "(11) 98888-7777")).ok).toBe(true);
    expect((await obterTurnoCompleto(u.cliente, c.turnoId))?.obra.whatsapp_planejador).toBe("5511988887777");
    expect((await editarWhatsappObra(u.cliente, c.obraId, "12")).ok).toBe(false);
    expect((await editarWhatsappObra(u.cliente, c.obraId, "")).ok).toBe(true);
    expect((await obterTurnoCompleto(u.cliente, c.turnoId))?.obra.whatsapp_planejador).toBeNull();
  });
});
