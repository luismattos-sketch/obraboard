import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adicionarAtividade } from "@/lib/db/atividades";
import { ERRO_FECHADO_CAMPO } from "@/lib/db/mensagens";
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
    const l = await aplicarAcao(u.cliente, t.dados.id, "liberar");
    if (!l.ok || !l.dados.token) throw new Error("liberar");
    return { obraId: o.dados.id, turnoId: t.dados.id, atividadeId: a.dados.id, token: l.dados.token, ana: r!.id as string };
  }

  it("marcar, repetir (uma linha só) e desfazer", { timeout: 60_000 }, async () => {
    const c = await cenario();
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
    const e = await salvarExecucaoPlanejador(u.cliente, c.turnoId, c.atividadeId, { qtd_realizada: 1, causa: null, observacao: null }, VAZIO);
    if (!e.ok) throw new Error(e.erro);
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
