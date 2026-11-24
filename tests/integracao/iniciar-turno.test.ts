import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adicionarAtividade } from "@/lib/db/atividades";
import { ERRO_FECHADO_CAMPO } from "@/lib/db/mensagens";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarObra } from "@/lib/db/obras";
import { desfazerIniciouCampo, marcarIniciouCampo } from "@/lib/db/iniciados";
import { desfazerTerminouCampo, marcarTerminouCampo } from "@/lib/db/terminados";
import { aplicarAcao, criarTurno, obterTurnoCompleto } from "@/lib/db/turnos";
import { salvarExecucaoPlanejador } from "@/lib/db/execucao";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, VAZIO, type UsuarioTeste } from "./ajuda";

describe.skipIf(!ligado)("iniciar turno por equipe e horário real", () => {
  let u: UsuarioTeste;
  beforeAll(async () => {
    u = await criarUsuarioTeste();
  });
  afterAll(async () => {
    if (u) await removerUsuarioTeste(u.userId);
  });

  async function cenario() {
    const o = await criarObra(u.cliente, { nome: "Obra Iniciar" });
    if (!o.ok) throw new Error(o.erro);
    const t = await criarTurno(u.cliente, {
      obra_id: o.dados.id, data: "2026-11-16", periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00",
    });
    if (!t.ok) throw new Error(t.erro);
    const a = await adicionarAtividade(u.cliente, t.dados.id, { descricao: "Bomba", unidade: "un", qtd_planejada: 1 });
    const b = await adicionarAtividade(u.cliente, t.dados.id, { descricao: "Tubo", unidade: "tubo", qtd_planejada: 8 });
    if (!a.ok || !b.ok) throw new Error("atividade");
    const admin = criarClienteAdmin();
    const ana = (await admin.from("responsaveis").insert({ obra_id: o.dados.id, nome: "Ana" }).select("id").single()).data!.id as string;
    const joao = (await admin.from("responsaveis").insert({ obra_id: o.dados.id, nome: "João" }).select("id").single()).data!.id as string;
    await admin.from("atividades").update({ responsavel_id: ana }).eq("id", a.dados.id);
    await admin.from("atividades").update({ responsavel_id: joao }).eq("id", b.dados.id);
    const l = await aplicarAcao(u.cliente, t.dados.id, "liberar");
    if (!l.ok || !l.dados.token) throw new Error("liberar");
    return { obraId: o.dados.id, turnoId: t.dados.id, daAna: a.dados.id, daJoao: b.dados.id, token: l.dados.token, ana, joao };
  }
  const horario = async (id: string) =>
    (await criarClienteAdmin().from("turnos").select("hora_inicio_real, hora_fim_real").eq("id", id).single()).data!;

  it("primeiro toque vale; repetir não muda; desfazer passa para o seguinte", { timeout: 60_000 }, async () => {
    const c = await cenario();
    expect(await marcarIniciouCampo(c.token, c.ana, "07:12")).toEqual({ ok: true, dados: undefined });
    expect((await horario(c.turnoId)).hora_inicio_real).toBe("07:12:00");
    expect((await marcarIniciouCampo(c.token, c.ana, "07:20")).ok).toBe(true);
    expect((await horario(c.turnoId)).hora_inicio_real).toBe("07:12:00");
    expect((await marcarIniciouCampo(c.token, c.joao, "07:30")).ok).toBe(true);
    expect((await obterTurnoCompleto(u.cliente, c.turnoId))?.iniciados).toEqual([
      { responsavel_id: c.ana, iniciou_em: "07:12:00" },
      { responsavel_id: c.joao, iniciou_em: "07:30:00" },
    ]);
    expect((await desfazerIniciouCampo(c.token, c.ana)).ok).toBe(true);
    expect((await horario(c.turnoId)).hora_inicio_real).toBe("07:30:00");
    expect((await desfazerIniciouCampo(c.token, c.joao)).ok).toBe(true);
    expect((await horario(c.turnoId)).hora_inicio_real).toBeNull();
  });

  it("fim real só quando todas as equipes terminam; desfazer limpa", { timeout: 60_000 }, async () => {
    const c = await cenario();
    for (const [id, q] of [[c.daAna, 1], [c.daJoao, 8]] as const) {
      const r = await salvarExecucaoPlanejador(u.cliente, c.turnoId, id, { qtd_realizada: q, causa: null, observacao: null }, VAZIO);
      if (!r.ok) throw new Error(r.erro);
    }
    expect((await marcarTerminouCampo(c.token, c.ana, "16:00")).ok).toBe(true);
    expect((await horario(c.turnoId)).hora_fim_real).toBeNull();
    expect((await marcarTerminouCampo(c.token, c.joao, "16:40")).ok).toBe(true);
    expect((await horario(c.turnoId)).hora_fim_real).toBe("16:40:00");
    expect((await desfazerTerminouCampo(c.token, c.joao)).ok).toBe(true);
    expect((await horario(c.turnoId)).hora_fim_real).toBeNull();
  });

  it("hora inválida é recusada", { timeout: 60_000 }, async () => {
    const c = await cenario();
    expect(await marcarIniciouCampo(c.token, c.ana, "25:00")).toEqual({ ok: false, erro: "Informe o horário" });
  });

  it("responsável de outra obra é recusado no banco", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const o2 = await criarObra(u.cliente, { nome: "Outra obra" });
    if (!o2.ok) throw new Error(o2.erro);
    const alheio = (await criarClienteAdmin().from("responsaveis").insert({ obra_id: o2.dados.id, nome: "Zé" }).select("id").single()).data!.id as string;
    expect((await marcarIniciouCampo(c.token, alheio, "07:00")).ok).toBe(false);
    const { error } = await criarClienteAdmin().from("clima").insert({ turno_id: c.turnoId, periodo: "manha", condicao: "bom", lancado_por_id: alheio });
    expect(error).not.toBeNull();
  });

  it("turno fechado recusa", { timeout: 60_000 }, async () => {
    const c = await cenario();
    for (const [id, q] of [[c.daAna, 1], [c.daJoao, 8]] as const) {
      const r = await salvarExecucaoPlanejador(u.cliente, c.turnoId, id, { qtd_realizada: q, causa: null, observacao: null }, VAZIO);
      if (!r.ok) throw new Error(r.erro);
    }
    const f = await aplicarAcao(u.cliente, c.turnoId, "fechar");
    if (!f.ok) throw new Error(f.erro);
    expect(await marcarIniciouCampo(c.token, c.ana, "07:00")).toMatchObject({ ok: false });
    void ERRO_FECHADO_CAMPO;
  });
});
