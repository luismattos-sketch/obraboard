import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarObra } from "@/lib/db/obras";
import {
  criarRascunho,
  dadosOficiais,
  encerrarSemana,
  listarProgramadasParaAnalise,
  listarSemanasComResumo,
  obterDadosSemana,
  obterSemana,
  programarSemana,
  reabrirSemana,
  removerAtividadeProgramada,
  salvarAtividadeProgramada,
  type EntradaAtividadeProgramada,
} from "@/lib/db/programacao";
import { ERRO_MOTIVO, ERRO_MOTIVO_REPETIDO } from "@/lib/dominio/eventos";
import { resumirSemana } from "@/lib/dominio/programacao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

const ENTRADA: EntradaAtividadeProgramada = {
  descricao: "Montar tubulação", unidade: "m", meta: 10, dias: [0, 1], periodo: "diurno",
  equipe: [{ funcao: "Caldeireiro", quantidade: 2 }, { funcao: "Ajudante", quantidade: 2 }],
};

describe.skipIf(!ligado)("camada de dados da programação", () => {
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

  async function semanaNova() {
    const obra = exigir(await criarObra(u.cliente, { nome: "Obra Dados Prog" }));
    const semana = exigir(await criarRascunho(u.cliente, obra.id, "2026-11-12"));
    return { obraId: obra.id, semana };
  }

  async function turnoComExecucao(obraId: string, progId: string, realizado: number, fechar: boolean) {
    const { data: t, error } = await u.cliente.from("turnos")
      .insert({ obra_id: obraId, data: "2026-11-09", periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00" })
      .select("id").single();
    if (error) throw new Error(error.message);
    const r = await u.cliente.from("atividades").insert({
      turno_id: t.id, descricao: "Montar tubulação", unidade: "m", qtd_planejada: 5,
      qtd_realizada: realizado, causa: realizado < 10 ? "material" : null, programacao_atividade_id: progId,
    });
    if (r.error) throw new Error(r.error.message);
    if (fechar) {
      const f = await u.cliente.from("turnos").update({ status: "fechado", fechado_em: new Date().toISOString() }).eq("id", t.id);
      if (f.error) throw new Error(f.error.message);
    }
    return t.id as string;
  }

  it("criarRascunho converte para a segunda e é idempotente", async () => {
    const { obraId, semana } = await semanaNova();
    expect(semana.inicio).toBe("2026-11-09");
    expect(semana.status).toBe("rascunho");
    const de_novo = exigir(await criarRascunho(u.cliente, obraId, "2026-11-15"));
    expect(de_novo.id).toBe(semana.id);
    expect((await obterSemana(u.cliente, obraId, "2026-11-09"))?.id).toBe(semana.id);
    expect(await obterSemana(u.cliente, obraId, "2026-11-16")).toBeNull();
  });

  it("salvar substitui a equipe e valida campos", async () => {
    const { semana } = await semanaNova();
    const { id } = exigir(await salvarAtividadeProgramada(u.cliente, semana.id, ENTRADA));
    exigir(await salvarAtividadeProgramada(u.cliente, semana.id, { ...ENTRADA, equipe: [{ funcao: "Soldador", quantidade: 1 }] }, id));
    const d = await obterDadosSemana(u.cliente, semana);
    expect(d.atividades).toHaveLength(1);
    expect(d.atividades[0]).toMatchObject({ id, meta: 10, dias: [0, 1], periodo: "diurno", equipe: [{ funcao: "Soldador", quantidade: 1 }] });

    const meta0 = await salvarAtividadeProgramada(u.cliente, semana.id, { ...ENTRADA, meta: 0 });
    expect(meta0.ok).toBe(false);
    if (!meta0.ok) expect(meta0.campos?.meta).toBeTruthy();
    const semDias = await salvarAtividadeProgramada(u.cliente, semana.id, { ...ENTRADA, dias: [] });
    expect(semDias.ok).toBe(false);
    if (!semDias.ok) expect(semDias.campos?.dias).toBeTruthy();
    const semDescricao = await salvarAtividadeProgramada(u.cliente, semana.id, { ...ENTRADA, descricao: "  " });
    expect(semDescricao.ok).toBe(false);
  });

  it("programar vazia, programar e travar", async () => {
    const { semana } = await semanaNova();
    expect(await programarSemana(u.cliente, semana.id)).toEqual({ ok: false, erro: "Inclua ao menos uma atividade para programar." });
    exigir(await salvarAtividadeProgramada(u.cliente, semana.id, ENTRADA));
    exigir(await programarSemana(u.cliente, semana.id));
    expect(await salvarAtividadeProgramada(u.cliente, semana.id, ENTRADA)).toEqual({
      ok: false, erro: "A semana já foi programada. Reabra para editar.",
    });
  });

  it("encerrar: turno aberto, causa pendente, completo; foto oficial congela", { timeout: 60_000 }, async () => {
    const { obraId, semana } = await semanaNova();
    const { id } = exigir(await salvarAtividadeProgramada(u.cliente, semana.id, ENTRADA));
    exigir(await programarSemana(u.cliente, semana.id));
    const turnoId = await turnoComExecucao(obraId, id, 4, false);
    const programada = (await obterSemana(u.cliente, obraId, semana.inicio))!;

    expect(await encerrarSemana(u.cliente, programada, { [id]: "material" })).toEqual({
      ok: false, erro: "Feche os turnos da semana antes de encerrar: 09/11 diurno.",
    });
    await u.cliente.from("turnos").update({ status: "fechado", fechado_em: new Date().toISOString() }).eq("id", turnoId);
    expect(await encerrarSemana(u.cliente, programada, {})).toEqual({ ok: false, erro: "Informe a causa das atividades não cumpridas." });
    exigir(await encerrarSemana(u.cliente, programada, { [id]: "material" }));

    const encerrada = (await obterSemana(u.cliente, obraId, semana.inicio))!;
    expect(encerrada.status).toBe("encerrada");
    const oficial = resumirSemana(await dadosOficiais(u.cliente, encerrada));
    expect(oficial.atividades[0]).toMatchObject({ meta: 10, realizado: 4, causa: "material", situacao: "em_andamento" });
    expect(oficial.ppc).toEqual({ cumpridas: 0, total: 1, ppc: 0 });

    const lista = await listarSemanasComResumo(u.cliente, obraId);
    expect(lista.map((l) => [l.semana.inicio, l.ppc?.ppc])).toEqual([["2026-11-09", 0]]);
  });

  it("dadosOficiais da encerrada vem da foto, não do ao vivo", { timeout: 60_000 }, async () => {
    const { obraId, semana } = await semanaNova();
    const { id } = exigir(await salvarAtividadeProgramada(u.cliente, semana.id, ENTRADA));
    exigir(await programarSemana(u.cliente, semana.id));
    await turnoComExecucao(obraId, id, 10, true);
    const programada = (await obterSemana(u.cliente, obraId, semana.inicio))!;
    exigir(await encerrarSemana(u.cliente, programada, {}));
    const encerrada = (await obterSemana(u.cliente, obraId, semana.inicio))!;
    // A trava impede mudar o ao vivo; então adultera a última foto (admin) e confere que a leitura segue a foto.
    const admin = criarClienteAdmin();
    const { data: v } = await admin.from("semana_versoes").select("id, dados").eq("semana_id", semana.id).order("numero", { ascending: false }).limit(1).single();
    const dados = v!.dados as { atividades: { meta: number }[] };
    dados.atividades[0].meta = 77;
    await admin.from("semana_versoes").update({ dados }).eq("id", v!.id);
    expect((await dadosOficiais(u.cliente, encerrada)).atividades[0].meta).toBe(77);
    expect((await obterDadosSemana(u.cliente, encerrada)).atividades[0].meta).toBe(10);
  });

  it("reabrir exige motivo novo", async () => {
    const { semana } = await semanaNova();
    exigir(await salvarAtividadeProgramada(u.cliente, semana.id, ENTRADA));
    exigir(await programarSemana(u.cliente, semana.id));
    expect(await reabrirSemana(u.cliente, semana.id, "  ")).toEqual({ ok: false, erro: ERRO_MOTIVO });
    exigir(await reabrirSemana(u.cliente, semana.id, "Faltou atividade"));
    exigir(await programarSemana(u.cliente, semana.id));
    expect(await reabrirSemana(u.cliente, semana.id, " Faltou atividade ")).toEqual({ ok: false, erro: ERRO_MOTIVO_REPETIDO });
  });

  it("remover com execução é bloqueado", async () => {
    const { obraId, semana } = await semanaNova();
    const { id } = exigir(await salvarAtividadeProgramada(u.cliente, semana.id, ENTRADA));
    await turnoComExecucao(obraId, id, 1, false);
    expect(await removerAtividadeProgramada(u.cliente, id)).toEqual({
      ok: false, erro: "Esta atividade já tem execução em turnos e não pode ser apagada.",
    });
  });

  it("listarProgramadasParaAnalise: programadas/encerradas a partir da data, com causas", { timeout: 60_000 }, async () => {
    const { obraId, semana } = await semanaNova();
    const { id } = exigir(await salvarAtividadeProgramada(u.cliente, semana.id, ENTRADA));
    exigir(await salvarAtividadeProgramada(u.cliente, semana.id, { ...ENTRADA, descricao: "Pintar" }));
    exigir(await programarSemana(u.cliente, semana.id));
    await turnoComExecucao(obraId, id, 4, false);
    exigir(await criarRascunho(u.cliente, obraId, "2026-11-16"));

    const lista = await listarProgramadasParaAnalise(u.cliente, obraId, "2026-11-02");
    expect(lista).toEqual([
      {
        inicio: "2026-11-09", encerrada: false, cumpridas: 0, total: 2,
        naoCumpridas: [{ descricao: "Montar tubulação", causa: "material" }, { descricao: "Pintar", causa: null }],
      },
    ]);
    expect(await listarProgramadasParaAnalise(u.cliente, obraId, "2026-11-10")).toEqual([]);
  });

  it("salvar com dias que tiram a execução explica o bloqueio", { timeout: 60_000 }, async () => {
    const { obraId, semana } = await semanaNova();
    const { id } = exigir(await salvarAtividadeProgramada(u.cliente, semana.id, ENTRADA));
    exigir(await programarSemana(u.cliente, semana.id));
    await turnoComExecucao(obraId, id, 2, false);
    exigir(await reabrirSemana(u.cliente, semana.id, "Mudar dias"));
    expect(await salvarAtividadeProgramada(u.cliente, semana.id, { ...ENTRADA, dias: [3, 4] }, id)).toEqual({
      ok: false,
      erro: "Esta atividade já foi executada em turnos fora desses dias ou período. Mantenha os dias e o período desses turnos.",
    });
  });
});

