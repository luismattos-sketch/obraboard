import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarObra } from "@/lib/db/obras";
import { criarRascunho, programarSemana, salvarAtividadeProgramada } from "@/lib/db/programacao";
import { aplicarAcao, criarTurno } from "@/lib/db/turnos";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

describe.skipIf(!ligado)("serviço extra e adiantada no banco", () => {
  let u: UsuarioTeste;
  beforeAll(async () => {
    u = await criarUsuarioTeste();
  });
  afterAll(async () => {
    if (u) await removerUsuarioTeste(u.userId);
  });

  const exigir = <T,>(r: { ok: true; dados: T } | { ok: false; erro: string }): T => {
    if (!r.ok) throw new Error(r.erro);
    return r.dados;
  };
  async function cenario() {
    const o = exigir(await criarObra(u.cliente, { nome: "Obra Extra" }));
    const t = exigir(await criarTurno(u.cliente, {
      obra_id: o.id, data: "2026-11-18", periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00",
    }));
    return { obraId: o.id, turnoId: t.id };
  }
  const extra = (turnoId: string, x: Record<string, unknown> = {}) =>
    u.cliente.from("atividades").insert({
      turno_id: turnoId, descricao: "Troca de iluminação", unidade: "un", qtd_planejada: 1, qtd_realizada: 12, tipo: "extra", ...x,
    }).select("id, qtd_planejada").single();

  it("extra: planejado acompanha executado", async () => {
    const c = await cenario();
    const r = await extra(c.turnoId);
    expect(r.error).toBeNull();
    expect(Number(r.data!.qtd_planejada)).toBe(12);
    await u.cliente.from("atividades").update({ qtd_realizada: 7 }).eq("id", r.data!.id);
    const { data } = await u.cliente.from("atividades").select("qtd_planejada").eq("id", r.data!.id).single();
    expect(Number(data!.qtd_planejada)).toBe(7);
  });

  it("extra sem quantidade recusa", async () => {
    const c = await cenario();
    const r = await extra(c.turnoId);
    const { error } = await u.cliente.from("atividades").update({ qtd_realizada: null }).eq("id", r.data!.id);
    expect(error?.message).toContain("extra_sem_quantidade");
  });

  it("checks de tipo", async () => {
    const c = await cenario();
    const semana = exigir(await criarRascunho(u.cliente, c.obraId, "2026-11-16"));
    const { id: progId } = exigir(await salvarAtividadeProgramada(u.cliente, semana.id, {
      descricao: "Pintura", unidade: "m²", meta: 80, dias: [3, 4], periodo: "diurno", equipe: [],
    }));
    const base = { turno_id: c.turnoId, descricao: "X", unidade: "un", qtd_planejada: 5 };
    expect((await u.cliente.from("atividades").insert({ ...base, tipo: "adiantada" })).error?.code).toBe("23514");
    expect((await u.cliente.from("atividades").insert({ ...base, qtd_realizada: 5, tipo: "extra", programacao_atividade_id: progId })).error).not.toBeNull();
    expect((await u.cliente.from("atividades").insert({ ...base, foto_path: "a/b.jpg" })).error?.code).toBe("23514");
  });

  it("fechar ignora extra e adiantada", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const semana = exigir(await criarRascunho(u.cliente, c.obraId, "2026-11-16"));
    const { id: progId } = exigir(await salvarAtividadeProgramada(u.cliente, semana.id, {
      descricao: "Pintura", unidade: "m²", meta: 80, dias: [3, 4], periodo: "diurno", equipe: [],
    }));
    exigir(await programarSemana(u.cliente, semana.id));
    const ad = await u.cliente.from("atividades").insert({
      turno_id: c.turnoId, descricao: "Pintura", unidade: "m²", qtd_planejada: 80, tipo: "adiantada", programacao_atividade_id: progId,
    });
    expect(ad.error).toBeNull();
    expect((await extra(c.turnoId)).error).toBeNull();
    exigir(await aplicarAcao(u.cliente, c.turnoId, "liberar"));
    const r = await aplicarAcao(u.cliente, c.turnoId, "enviar");
    expect(r.ok).toBe(true);
  });

  it("ligação com a programação: atrasada aceita, futura sem marca de adiantada recusa", async () => {
    const c = await cenario();
    const semana = exigir(await criarRascunho(u.cliente, c.obraId, "2026-11-16"));
    const passada = exigir(await salvarAtividadeProgramada(u.cliente, semana.id, {
      descricao: "Andaime", unidade: "m³", meta: 10, dias: [0, 1], periodo: "diurno", equipe: [],
    }));
    const futura = exigir(await salvarAtividadeProgramada(u.cliente, semana.id, {
      descricao: "Pintura", unidade: "m²", meta: 80, dias: [3, 4], periodo: "diurno", equipe: [],
    }));
    exigir(await programarSemana(u.cliente, semana.id));
    const base = { turno_id: c.turnoId, descricao: "X", unidade: "un", qtd_planejada: 5 };
    expect((await u.cliente.from("atividades").insert({ ...base, programacao_atividade_id: passada.id })).error).toBeNull();
    expect((await u.cliente.from("atividades").insert({ ...base, programacao_atividade_id: futura.id })).error?.message).toBe("programacao_incompativel");
    expect((await u.cliente.from("atividades").insert({ ...base, programacao_atividade_id: passada.id, tipo: "adiantada" })).error).not.toBeNull();
  });

  it("criada_por_id de outra obra recusa", async () => {
    const c = await cenario();
    const outra = exigir(await criarObra(u.cliente, { nome: "Outra" }));
    const { data: r } = await u.cliente.from("responsaveis").insert({ obra_id: outra.id, nome: "Fulano" }).select("id").single();
    const { error } = await extra(c.turnoId, { criada_por_id: r!.id });
    expect(error?.message).toContain("responsavel_invalido");
  });

  it("foto_rdo inclui tipo", async () => {
    const c = await cenario();
    await extra(c.turnoId);
    const { data, error } = await criarClienteAdmin().rpc("foto_rdo", { p_turno_id: c.turnoId });
    expect(error).toBeNull();
    const at = (data as { atividades: { tipo: string | null }[] }).atividades;
    expect(at.map((a) => a.tipo)).toContain("extra");
  });
});
