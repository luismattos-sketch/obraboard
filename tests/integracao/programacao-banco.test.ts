import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarObra } from "@/lib/db/obras";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

const INICIO = "2026-11-09"; // segunda-feira

describe.skipIf(!ligado)("programação semanal no banco", () => {
  let u: UsuarioTeste;
  let outro: UsuarioTeste;
  beforeAll(async () => {
    u = await criarUsuarioTeste();
    outro = await criarUsuarioTeste();
  });
  afterAll(async () => {
    if (u) await removerUsuarioTeste(u.userId);
    if (outro) await removerUsuarioTeste(outro.userId);
  });

  const exigir = <T,>(r: { ok: true; dados: T } | { ok: false; erro: string }): T => {
    if (!r.ok) throw new Error(r.erro);
    return r.dados;
  };
  const semErro = <T extends { error: { message: string } | null }>(r: T): T => {
    if (r.error) throw new Error(r.error.message);
    return r;
  };

  async function novaSemana() {
    const obra = exigir(await criarObra(u.cliente, { nome: "Obra Programação" }));
    const { data } = semErro(await u.cliente.from("semanas").insert({ obra_id: obra.id, inicio: INICIO }).select("id").single());
    return { obraId: obra.id, semanaId: data!.id as string };
  }

  async function novaAtividade(semanaId: string, extra: Record<string, unknown> = {}) {
    const { data } = semErro(
      await u.cliente
        .from("programacao_atividades")
        .insert({ semana_id: semanaId, descricao: "Montar tubulação", unidade: "m", meta: 10, dias: [0, 1], periodo: "diurno", ...extra })
        .select("id")
        .single(),
    );
    const id = data!.id as string;
    semErro(await u.cliente.from("programacao_efetivo").insert({ programacao_atividade_id: id, funcao: "Caldeireiro", quantidade: 2 }));
    return id;
  }

  const status = (semanaId: string, s: string, motivo?: string) =>
    u.cliente.from("semanas").update({ status: s, ...(motivo !== undefined ? { motivo_reabertura: motivo } : {}) }).eq("id", semanaId);

  async function novoTurno(obraId: string, data = "2026-11-09", periodo = "diurno") {
    const { data: t } = semErro(
      await u.cliente
        .from("turnos")
        .insert({ obra_id: obraId, data, periodo, hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00" })
        .select("id")
        .single(),
    );
    return t!.id as string;
  }

  const ligar = (turnoId: string, progId: string, realizado: number | null = null, causa: string | null = null) =>
    u.cliente.from("atividades").insert({
      turno_id: turnoId, descricao: "Montar tubulação", unidade: "m", qtd_planejada: 5,
      qtd_realizada: realizado, causa, programacao_atividade_id: progId,
    });

  const fechar = (turnoId: string) =>
    u.cliente.from("turnos").update({ status: "fechado", fechado_em: new Date().toISOString() }).eq("id", turnoId);

  it("programar sem atividade", async () => {
    const { semanaId } = await novaSemana();
    expect((await status(semanaId, "programada")).error?.message).toBe("programacao_vazia");
  });

  it("semana programada trava atividades e equipe", async () => {
    const { semanaId } = await novaSemana();
    const id = await novaAtividade(semanaId);
    semErro(await status(semanaId, "programada"));
    const ins = await u.cliente.from("programacao_atividades").insert({ semana_id: semanaId, descricao: "x", meta: 1, dias: [0] });
    expect(ins.error?.message).toBe("semana_travada");
    const upd = await u.cliente.from("programacao_atividades").update({ descricao: "y" }).eq("id", id);
    expect(upd.error?.message).toBe("semana_travada");
    const del = await u.cliente.from("programacao_efetivo").delete().eq("programacao_atividade_id", id);
    expect(del.error?.message).toBe("semana_travada");
    semErro(await u.cliente.from("programacao_atividades").update({ causa: "material" }).eq("id", id));
  });

  it("causa em rascunho", async () => {
    const { semanaId } = await novaSemana();
    const id = await novaAtividade(semanaId);
    const r = await u.cliente.from("programacao_atividades").update({ causa: "material" }).eq("id", id);
    expect(r.error?.message).toBe("semana_travada");
  });

  it("rascunho direto para encerrada", async () => {
    const { semanaId } = await novaSemana();
    await novaAtividade(semanaId);
    expect((await status(semanaId, "encerrada")).error?.message).toBe("transicao_invalida");
  });

  it("dias inválidos são recusados", async () => {
    const { semanaId } = await novaSemana();
    for (const dias of [[], [7], [1, 1]]) {
      const r = await u.cliente.from("programacao_atividades").insert({ semana_id: semanaId, descricao: "x", meta: 1, dias });
      expect(r.error).not.toBeNull();
    }
  });

  it("início que não é segunda é recusado", async () => {
    const obra = exigir(await criarObra(u.cliente, { nome: "Obra Terça" }));
    const r = await u.cliente.from("semanas").insert({ obra_id: obra.id, inicio: "2026-11-10" });
    expect(r.error).not.toBeNull();
  });

  it("reabrir sem motivo e com motivo repetido", async () => {
    const { semanaId } = await novaSemana();
    await novaAtividade(semanaId);
    semErro(await status(semanaId, "programada"));
    expect((await status(semanaId, "rascunho")).error?.message).toBe("motivo_obrigatorio");
    semErro(await status(semanaId, "rascunho", "Faltou atividade"));
    semErro(await status(semanaId, "programada"));
    expect((await status(semanaId, "rascunho", "  Faltou atividade ")).error?.message).toBe("motivo_repetido");
  });

  it("encerrar exige turnos fechados e causa; versões ao programar e encerrar", { timeout: 60_000 }, async () => {
    const { obraId, semanaId } = await novaSemana();
    const id = await novaAtividade(semanaId);
    semErro(await status(semanaId, "programada"));
    const turno = await novoTurno(obraId);
    semErro(await ligar(turno, id, 3, "material"));

    const aberto = await u.cliente.rpc("encerrar_semana", { p_semana_id: semanaId, p_causas: { [id]: "material" } });
    expect(aberto.error?.message).toBe("turno_aberto");

    semErro(await fechar(turno));
    const semCausa = await u.cliente.rpc("encerrar_semana", { p_semana_id: semanaId, p_causas: {} });
    expect(semCausa.error?.message).toBe("causa_pendente");

    semErro(await u.cliente.rpc("encerrar_semana", { p_semana_id: semanaId, p_causas: { [id]: "material" } }));
    const { data: s } = await u.cliente.from("semanas").select("status, encerrada_em").eq("id", semanaId).single();
    expect(s!.status).toBe("encerrada");
    expect(s!.encerrada_em).not.toBeNull();

    const { data: vs } = semErro(
      await u.cliente.from("semana_versoes").select("numero, evento, dados").eq("semana_id", semanaId).order("numero"),
    );
    expect(vs!.map((v) => [v.numero, v.evento])).toEqual([[1, "programada"], [2, "encerrada"]]);
    const dados = vs![1].dados as {
      atividades: { causa: string; equipe: { funcao: string }[] }[];
      execucoes: { qtd_realizada: number; status_turno: string }[];
      turnos: { id: string }[];
    };
    expect(dados.atividades[0].equipe[0].funcao).toBe("Caldeireiro");
    expect(dados.atividades[0].causa).toBe("material");
    expect(dados.execucoes[0]).toMatchObject({ qtd_realizada: 3, status_turno: "fechado" });
    expect(dados.turnos.map((t) => t.id)).toEqual([turno]);

    const gravar = await u.cliente.from("semana_versoes").insert({ semana_id: semanaId, obra_id: obraId, numero: 9, evento: "encerrada", emitido_em: new Date().toISOString(), dados: {} });
    expect(gravar.error).not.toBeNull();
  });

  it("ligação fora do dia, do período ou da obra", async () => {
    const { obraId, semanaId } = await novaSemana();
    const id = await novaAtividade(semanaId);
    const quarta = await novoTurno(obraId, "2026-11-11");
    expect((await ligar(quarta, id)).error?.message).toBe("programacao_incompativel");
    const noturno = await novoTurno(obraId, "2026-11-09", "noturno");
    expect((await ligar(noturno, id)).error?.message).toBe("programacao_incompativel");
    const outraObra = exigir(await criarObra(u.cliente, { nome: "Outra" }));
    const deOutra = await novoTurno(outraObra.id, "2026-11-09");
    expect((await ligar(deOutra, id)).error?.message).toBe("programacao_incompativel");
  });

  it("mudar data de turno com atividade programada", async () => {
    const { obraId, semanaId } = await novaSemana();
    const id = await novaAtividade(semanaId);
    const turno = await novoTurno(obraId);
    semErro(await ligar(turno, id));
    const r = await u.cliente.from("turnos").update({ data: "2026-11-10" }).eq("id", turno);
    expect(r.error?.message).toBe("programacao_incompativel");
  });

  it("apagar atividade programada com execução", async () => {
    const { obraId, semanaId } = await novaSemana();
    const id = await novaAtividade(semanaId);
    const turno = await novoTurno(obraId);
    semErro(await ligar(turno, id));
    const r = await u.cliente.from("programacao_atividades").delete().eq("id", id);
    expect(r.error?.message).toBe("atividade_com_execucao");
  });

  it("apagar a obra com semana executada", { timeout: 60_000 }, async () => {
    const { obraId, semanaId } = await novaSemana();
    const id = await novaAtividade(semanaId);
    semErro(await status(semanaId, "programada"));
    const turno = await novoTurno(obraId);
    semErro(await ligar(turno, id, 10));
    semErro(await fechar(turno));
    semErro(await u.cliente.rpc("encerrar_semana", { p_semana_id: semanaId, p_causas: {} }));
    const admin = criarClienteAdmin();
    semErro(await admin.from("obras").delete().eq("id", obraId));
    const { data } = await admin.from("semanas").select("id").eq("obra_id", obraId);
    expect(data).toEqual([]);
  });

  it("outra empresa não vê a semana", async () => {
    const { semanaId } = await novaSemana();
    await novaAtividade(semanaId);
    const { data } = await outro.cliente.from("semanas").select("id").eq("id", semanaId);
    expect(data).toEqual([]);
    const { data: ats } = await outro.cliente.from("programacao_atividades").select("id").eq("semana_id", semanaId);
    expect(ats).toEqual([]);
  });
});
