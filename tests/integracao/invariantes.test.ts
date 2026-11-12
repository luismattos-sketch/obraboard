// Requer a migration supabase/migrations/20261109000000_frentia_invariantes.sql aplicada.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adicionarAtividade, removerAtividade, trazerPendentes } from "@/lib/db/atividades";
import { salvarEfetivo } from "@/lib/db/campo";
import { salvarEfetivoPlanejador, salvarHorarioPlanejador } from "@/lib/db/execucao";
import { criarObra } from "@/lib/db/obras";
import { aplicarAcao, criarTurno, editarTurno, obterTurnoCompleto, removerTurno } from "@/lib/db/turnos";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

const SO_PLANEJADO = "Só é possível alterar turnos planejados.";
const CONFLITO = "O efetivo foi alterado por outra pessoa. Recarregue a página.";
const HORAS = { hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00" };

describe.skipIf(!ligado)("invariantes do banco e edição de turno", () => {
  let u: UsuarioTeste;
  let obraId: string;
  beforeAll(async () => {
    u = await criarUsuarioTeste();
    const o = await criarObra(u.cliente, { nome: "Obra Invariantes" });
    if (!o.ok) throw new Error(o.erro);
    obraId = o.dados.id;
  });
  afterAll(async () => {
    // Também prova que a cascata (obra -> turno fechado -> filhos) não é barrada pelo trigger.
    if (u) await removerUsuarioTeste(u.userId);
  });

  async function turno(data: string, periodo: "diurno" | "noturno" = "diurno") {
    const t = await criarTurno(u.cliente, { obra_id: obraId, data, periodo, ...HORAS });
    if (!t.ok) throw new Error(t.erro);
    return t.dados;
  }
  async function atividade(turnoId: string, qtd = 10) {
    const a = await adicionarAtividade(u.cliente, turnoId, { descricao: "A", unidade: "m", qtd_planejada: qtd });
    if (!a.ok) throw new Error(a.erro);
    return a.dados;
  }
  async function emCampo(data: string) {
    const t = await turno(data);
    const a = await atividade(t.id);
    const l = await aplicarAcao(u.cliente, t.id, "liberar");
    if (!l.ok || !l.dados.token) throw new Error("liberar");
    return { turnoId: t.id, atividadeId: a.id, token: l.dados.token };
  }
  async function fechado(data: string) {
    const r = await emCampo(data);
    const { error } = await u.cliente.from("atividades").update({ qtd_realizada: 10 }).eq("id", r.atividadeId);
    if (error) throw new Error(error.message);
    const f = await aplicarAcao(u.cliente, r.turnoId, "fechar");
    if (!f.ok) throw new Error(f.erro);
    return r;
  }

  it("editarTurno: altera turno planejado, recusa duplicado e horário inválido", { timeout: 60_000 }, async () => {
    const t = await turno("2027-03-01");
    await turno("2027-03-02", "noturno");
    const r = await editarTurno(u.cliente, t.id, {
      data: "2027-03-03",
      periodo: "noturno",
      hora_inicio_prevista: "19:00",
      hora_fim_prevista: "05:00",
    });
    expect(r.ok).toBe(true);
    const lido = await obterTurnoCompleto(u.cliente, t.id);
    expect(lido).toMatchObject({ data: "2027-03-03", periodo: "noturno", hora_inicio_prevista: "19:00:00", hora_fim_prevista: "05:00:00" });

    expect(await editarTurno(u.cliente, t.id, { data: "2027-03-02", periodo: "noturno" })).toEqual({
      ok: false,
      erro: "Já existe um turno noturno nesse dia",
    });
    expect(await editarTurno(u.cliente, t.id, { data: "2027-03-03", periodo: "noturno", hora_inicio_prevista: "7h" })).toEqual({
      ok: false,
      erro: "Horário inválido",
    });
    expect(await criarTurno(u.cliente, { obra_id: obraId, data: "2027-03-09", periodo: "diurno", hora_fim_prevista: "25:00" })).toEqual({
      ok: false,
      erro: "Horário inválido",
    });
  });

  it("editarTurno/removerTurno recusam turno em campo; removerTurno apaga planejado", { timeout: 60_000 }, async () => {
    const { turnoId } = await emCampo("2027-03-10");
    expect(await editarTurno(u.cliente, turnoId, { data: "2027-03-11", periodo: "diurno" })).toEqual({ ok: false, erro: SO_PLANEJADO });
    expect(await removerTurno(u.cliente, turnoId)).toEqual({ ok: false, erro: SO_PLANEJADO });
    expect(await obterTurnoCompleto(u.cliente, turnoId)).not.toBeNull();

    const p = await turno("2027-03-12");
    await atividade(p.id);
    expect(await removerTurno(u.cliente, p.id)).toEqual({ ok: true, dados: undefined });
    expect(await obterTurnoCompleto(u.cliente, p.id)).toBeNull();
    expect(await removerTurno(u.cliente, p.id)).toEqual({ ok: false, erro: "Turno não encontrado" });
  });

  it("substituir_efetivo: conflito quando o efetivo esperado não confere", { timeout: 60_000 }, async () => {
    const { turnoId, token } = await emCampo("2027-03-20");
    const pedreiro = [{ funcao: "Pedreiro", quantidade: 3 }];
    const servente = [{ funcao: "Servente", quantidade: 2 }];
    expect((await salvarEfetivo(token, pedreiro, [])).ok).toBe(true);
    // planejador com a tela antiga (efetivo vazio) não sobrescreve
    expect(await salvarEfetivoPlanejador(u.cliente, turnoId, null, servente, [])).toEqual({ ok: false, erro: CONFLITO });
    expect((await obterTurnoCompleto(u.cliente, turnoId))?.efetivo.map((e) => e.funcao)).toEqual(["Pedreiro"]);
    // com o esperado certo (ordem não importa), substitui
    const dois = [{ funcao: "Servente", quantidade: 2 }, { funcao: "Pedreiro", quantidade: 3 }];
    expect((await salvarEfetivoPlanejador(u.cliente, turnoId, null, dois, pedreiro)).ok).toBe(true);
    expect(await salvarEfetivo(token, [], pedreiro)).toEqual({ ok: false, erro: CONFLITO });
    expect((await salvarEfetivo(token, [], [...dois].reverse())).ok).toBe(true);
    expect((await obterTurnoCompleto(u.cliente, turnoId))?.efetivo).toEqual([]);
  });

  it("turno fechado: filhos e dados do turno imutáveis no banco, inclusive para o admin", { timeout: 60_000 }, async () => {
    const { turnoId, atividadeId } = await fechado("2027-04-01");
    const admin = criarClienteAdmin();
    for (const c of [u.cliente, admin]) {
      const ins = await c.from("atividades").insert({ turno_id: turnoId, descricao: "X", unidade: "m", qtd_planejada: 1 });
      expect(ins.error?.message).toBe("turno_fechado");
      const upd = await c.from("atividades").update({ qtd_realizada: 1 }).eq("id", atividadeId);
      expect(upd.error?.message).toBe("turno_fechado");
      const del = await c.from("atividades").delete().eq("id", atividadeId);
      expect(del.error?.message).toBe("turno_fechado");
      const ef = await c.from("efetivo").insert({ turno_id: turnoId, funcao: "Pedreiro", quantidade: 1 });
      expect(ef.error?.message).toBe("turno_fechado");
      const cl = await c.from("clima").insert({ turno_id: turnoId, periodo: "manha", condicao: "bom" });
      expect(cl.error?.message).toBe("turno_fechado");
      const h = await c.from("turnos").update({ hora_inicio_real: "08:00" }).eq("id", turnoId);
      expect(h.error?.message).toBe("turno_fechado");
      const d = await c.from("turnos").update({ data: "2027-04-02" }).eq("id", turnoId);
      expect(d.error?.message).toBe("turno_fechado");
    }
    // efetivo pela função também é barrado (trigger dentro da transação)
    const rpc = await admin.rpc("substituir_efetivo", { p_turno_id: turnoId, p_responsavel_id: null, p_esperado: [], p_linhas: [] });
    expect(rpc.error).toBeNull(); // nada a apagar/inserir: nenhuma linha tocada
    const rpc2 = await admin.rpc("substituir_efetivo", {
      p_turno_id: turnoId, p_responsavel_id: null,
      p_esperado: [],
      p_linhas: [{ funcao: "Pedreiro", quantidade: 1 }],
    });
    expect(rpc2.error?.message).toBe("turno_fechado");
    // token_hash pode mudar; reabrir (fechado -> enviado) é permitido
    expect((await admin.from("turnos").update({ token_hash: "x".repeat(64) }).eq("id", turnoId)).error).toBeNull();
    expect((await aplicarAcao(u.cliente, turnoId, "reabrir", { motivo: "Correção de teste" })).ok).toBe(true);
    expect((await salvarHorarioPlanejador(u.cliente, turnoId, { hora_inicio_real: "07:00", hora_fim_real: "16:00" })).ok).toBe(true);
  });

  it("causa_pendente: o banco recusa enviar/fechar com atividade sem causa", { timeout: 60_000 }, async () => {
    const { turnoId, atividadeId } = await emCampo("2027-04-10");
    const enviar = () => u.cliente.from("turnos").update({ status: "enviado" }).eq("id", turnoId);
    await u.cliente.from("atividades").update({ qtd_realizada: 4 }).eq("id", atividadeId);
    expect((await enviar()).error?.message).toBe("causa_pendente");
    await u.cliente.from("atividades").update({ causa: "outro", observacao: "  " }).eq("id", atividadeId);
    expect((await enviar()).error?.message).toBe("causa_pendente");
    expect((await u.cliente.from("turnos").update({ status: "fechado" }).eq("id", turnoId)).error?.message).toBe("causa_pendente");
    await u.cliente.from("atividades").update({ observacao: "faltou concreto" }).eq("id", atividadeId);
    expect((await enviar()).error).toBeNull();
  });

  it("origem única por turno; trazer pendentes concorrente não duplica", { timeout: 60_000 }, async () => {
    const a = await turno("2027-05-01");
    const x = await atividade(a.id);
    await atividade(a.id);
    const b = await turno("2027-05-02");
    const [r1, r2] = await Promise.all([trazerPendentes(u.cliente, b.id), trazerPendentes(u.cliente, b.id)]);
    expect(r1.ok && r2.ok).toBe(true);
    const total = (r1.ok ? r1.dados.adicionadas : 0) + (r2.ok ? r2.dados.adicionadas : 0);
    expect(total).toBe(2);
    expect((await obterTurnoCompleto(u.cliente, b.id))?.atividades).toHaveLength(2);

    const dup = await u.cliente
      .from("atividades")
      .insert({ turno_id: b.id, descricao: "dup", unidade: "m", qtd_planejada: 1, origem_id: x.id });
    expect(dup.error?.code).toBe("23505");
  });

  it("apagar a atividade de origem não é barrado por um turno fechado que a trouxe", { timeout: 60_000 }, async () => {
    const a = await turno("2027-06-01");
    const x = await atividade(a.id);
    const b = await turno("2027-06-02");
    expect(await trazerPendentes(u.cliente, b.id)).toEqual({ ok: true, dados: { adicionadas: 1 } });
    const liberado = await aplicarAcao(u.cliente, b.id, "liberar");
    expect(liberado.ok).toBe(true);
    await u.cliente.from("atividades").update({ qtd_realizada: 10 }).eq("turno_id", b.id);
    expect((await aplicarAcao(u.cliente, b.id, "fechar")).ok).toBe(true);

    // ON DELETE SET NULL de origem_id no turno fechado: só o vínculo muda.
    expect(await removerAtividade(u.cliente, x.id)).toEqual({ ok: true, dados: undefined });
    const depois = await obterTurnoCompleto(u.cliente, b.id);
    expect(depois?.atividades.map((t) => [t.origem_id, t.qtd_realizada])).toEqual([[null, 10]]);
  });

  it("membros: um usuário pertence a uma única empresa", { timeout: 60_000 }, async () => {
    const admin = criarClienteAdmin();
    const { data: emp } = await admin.from("empresas").insert({ nome: "Outra" }).select("id").single();
    try {
      const r = await admin.from("membros").insert({ empresa_id: emp!.id, user_id: u.userId, papel: "dono" });
      expect(r.error?.code).toBe("23505");
    } finally {
      await admin.from("empresas").delete().eq("id", emp!.id);
    }
  });
});
