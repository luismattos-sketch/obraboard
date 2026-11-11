import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { removerAtividade, trazerPendentes } from "@/lib/db/atividades";
import { criarObra } from "@/lib/db/obras";
import {
  criarRascunho,
  programarSemana,
  salvarAtividadeProgramada,
  semanaDoTurno,
  trazerDaProgramacao,
  type EntradaAtividadeProgramada,
} from "@/lib/db/programacao";
import { criarTurno, editarTurno } from "@/lib/db/turnos";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

const ENTRADA: EntradaAtividadeProgramada = {
  descricao: "Montar tubulação", unidade: "m", meta: 120, dias: [0, 1, 2], periodo: "diurno",
  equipe: [{ funcao: "Caldeireiro", quantidade: 2 }],
};

describe.skipIf(!ligado)("programação chega ao turno", () => {
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

  async function cenario(programar = true, entrada = ENTRADA) {
    const obra = exigir(await criarObra(u.cliente, { nome: "Obra Prog Turno" }));
    const semana = exigir(await criarRascunho(u.cliente, obra.id, "2026-11-09"));
    const { id: progId } = exigir(await salvarAtividadeProgramada(u.cliente, semana.id, entrada));
    if (programar) exigir(await programarSemana(u.cliente, semana.id));
    return { obraId: obra.id, semanaId: semana.id, progId };
  }

  const turno = (obraId: string, data: string, periodo: "diurno" | "noturno" = "diurno") =>
    criarTurno(u.cliente, { obra_id: obraId, data, periodo, hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00" });

  async function atividadesDo(turnoId: string) {
    const { data, error } = await u.cliente
      .from("atividades").select("id, qtd_planejada, programacao_atividade_id").eq("turno_id", turnoId);
    if (error) throw new Error(error.message);
    return data.map((a) => ({ ...a, qtd_planejada: Number(a.qtd_planejada) }));
  }

  it("criar turno na terça traz a atividade com sugestão", { timeout: 60_000 }, async () => {
    const { obraId, progId } = await cenario();
    const seg = exigir(await turno(obraId, "2026-11-09"));
    const [a] = await atividadesDo(seg.id);
    expect(a).toMatchObject({ qtd_planejada: 40, programacao_atividade_id: progId });
    await u.cliente.from("atividades").update({ qtd_realizada: 30 }).eq("id", a.id);

    const ter = exigir(await turno(obraId, "2026-11-10"));
    expect(await atividadesDo(ter.id)).toEqual([expect.objectContaining({ qtd_planejada: 40, programacao_atividade_id: progId })]);

    const qua = exigir(await turno(obraId, "2026-11-11"));
    expect((await atividadesDo(qua.id))[0].qtd_planejada).toBe(90); // último dia: saldo (120 − 30)
    expect((await semanaDoTurno(u.cliente, obraId, "2026-11-11"))?.status).toBe("programada");
  });

  it("turno noturno, dia não marcado, rascunho ou encerrada não trazem nada", { timeout: 60_000 }, async () => {
    const { obraId } = await cenario();
    expect(await atividadesDo(exigir(await turno(obraId, "2026-11-09", "noturno")).id)).toEqual([]);
    expect(await atividadesDo(exigir(await turno(obraId, "2026-11-12")).id)).toEqual([]);

    const rascunho = await cenario(false);
    expect(await atividadesDo(exigir(await turno(rascunho.obraId, "2026-11-09")).id)).toEqual([]);
    expect(await semanaDoTurno(u.cliente, rascunho.obraId, "2026-11-20")).toBeNull();
  });

  it("trazer da programação é idempotente", { timeout: 60_000 }, async () => {
    const { obraId } = await cenario();
    const t = exigir(await turno(obraId, "2026-11-09"));
    expect(await trazerDaProgramacao(u.cliente, t.id)).toEqual({ ok: true, dados: { adicionadas: 0 } });
    expect(await atividadesDo(t.id)).toHaveLength(1);
  });

  it("apagar no turno e trazer de novo", { timeout: 60_000 }, async () => {
    const { obraId, progId } = await cenario();
    const t = exigir(await turno(obraId, "2026-11-09"));
    const [a] = await atividadesDo(t.id);
    exigir(await removerAtividade(u.cliente, a.id));
    expect(await trazerDaProgramacao(u.cliente, t.id)).toEqual({ ok: true, dados: { adicionadas: 1 } });
    expect(await atividadesDo(t.id)).toEqual([expect.objectContaining({ qtd_planejada: 40, programacao_atividade_id: progId })]);
  });

  it("trazer pendentes ignora atividade programada", { timeout: 60_000 }, async () => {
    const { obraId } = await cenario();
    const seg = exigir(await turno(obraId, "2026-11-09"));
    const [a] = await atividadesDo(seg.id);
    await u.cliente.from("atividades").update({ qtd_realizada: 10 }).eq("id", a.id);
    const qui = exigir(await turno(obraId, "2026-11-12"));
    const r = await trazerPendentes(u.cliente, qui.id);
    expect(r).toEqual({ ok: true, dados: { adicionadas: 0 } });
    expect(await atividadesDo(qui.id)).toEqual([]);
  });

  it("editar data de turno com atividade programada explica o bloqueio", { timeout: 60_000 }, async () => {
    const { obraId } = await cenario();
    const t = exigir(await turno(obraId, "2026-11-09"));
    expect(await editarTurno(u.cliente, t.id, { data: "2026-11-12", periodo: "diurno" })).toEqual({
      ok: false,
      erro: "Este turno tem atividades da programação. Remova-as antes de mudar a data ou o período.",
    });
  });
});
