import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adicionarAtividade, editarAtividade } from "@/lib/db/atividades";
import { salvarClimaPlanejador, salvarEfetivoPlanejador, salvarExecucaoPlanejador } from "@/lib/db/execucao";
import { criarObra } from "@/lib/db/obras";
import { aplicarAcao, criarTurno, obterTurnoCompleto, removerTurno } from "@/lib/db/turnos";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

type Linha = { id: string; numero: number; retroativa: boolean; formato: number; emitido_em: string; dados: Record<string, unknown> };

describe.skipIf(!ligado)("rdo_versoes no banco", () => {
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

  /** Obra própria + turno liberado com 1 atividade; `comCausa` deixa o turno pronto para fechar. */
  async function turnoPronto(comCausa = true) {
    const obra = exigir(await criarObra(u.cliente, { nome: "Obra RDO" }));
    const t = exigir(await criarTurno(u.cliente, {
      obra_id: obra.id, data: "2026-11-09", periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "16:00",
    }));
    const at = exigir(await adicionarAtividade(u.cliente, t.id, { descricao: "Concretagem", unidade: "m³", qtd_planejada: 10 }));
    exigir(await aplicarAcao(u.cliente, t.id, "liberar"));
    exigir(await salvarExecucaoPlanejador(u.cliente, t.id, at.id, comCausa
      ? { qtd_realizada: 4, causa: "material", observacao: "faltou cimento" }
      : { qtd_realizada: 4, causa: null, observacao: null }));
    exigir(await salvarEfetivoPlanejador(u.cliente, t.id, [{ funcao: "Pedreiro", quantidade: 3 }], []));
    exigir(await salvarClimaPlanejador(u.cliente, t.id, { periodo: "manha", condicao: "bom", impediu: false }));
    return { obraId: obra.id, turnoId: t.id, atividadeId: at.id };
  }

  async function versoes(turnoId: string): Promise<Linha[]> {
    const { data, error } = await criarClienteAdmin()
      .from("rdo_versoes").select("id, numero, retroativa, formato, emitido_em, dados").eq("turno_id", turnoId).order("numero");
    if (error) throw new Error(error.message);
    return data as Linha[];
  }

  it("fechar cria a v1 com a foto do turno", { timeout: 60_000 }, async () => {
    const { turnoId } = await turnoPronto();
    exigir(await aplicarAcao(u.cliente, turnoId, "fechar"));
    const vs = await versoes(turnoId);
    expect(vs).toHaveLength(1);
    const [v] = vs;
    expect(v).toMatchObject({ numero: 1, retroativa: false, formato: 1 });
    const turno = await obterTurnoCompleto(u.cliente, turnoId);
    expect(new Date(v.emitido_em).getTime()).toBe(new Date(turno!.fechado_em!).getTime());
    const d = v.dados as {
      obra: { nome: string }; turno: { data: string; periodo: string };
      atividades: { descricao: string; qtd_planejada: number }[];
      efetivo: { funcao: string; quantidade: number }[]; clima: { periodo: string }[];
    };
    expect(d.obra.nome).toBe("Obra RDO");
    expect(d.turno).toMatchObject({ data: "2026-11-09", periodo: "diurno" });
    expect(d.atividades[0]).toMatchObject({ descricao: "Concretagem", qtd_planejada: 10 });
    expect(d.efetivo).toEqual([expect.objectContaining({ funcao: "Pedreiro", quantidade: 3 })]);
    expect(d.clima).toEqual([{ periodo: "manha", condicao: "bom", impediu: false }]);
    expect(JSON.stringify(v.dados)).not.toContain("token_hash");
  });

  it("reabrir, editar e fechar cria a v2 sem mudar a v1", { timeout: 60_000 }, async () => {
    const { turnoId, atividadeId } = await turnoPronto();
    exigir(await aplicarAcao(u.cliente, turnoId, "fechar"));
    const v1 = (await versoes(turnoId))[0];
    exigir(await aplicarAcao(u.cliente, turnoId, "reabrir"));
    exigir(await editarAtividade(u.cliente, atividadeId, { descricao: "Concretagem corrigida" }));
    exigir(await aplicarAcao(u.cliente, turnoId, "fechar"));
    const vs = await versoes(turnoId);
    expect(vs.map((v) => v.numero)).toEqual([1, 2]);
    expect(vs[0].dados).toEqual(v1.dados);
    expect((vs[1].dados as { atividades: { descricao: string }[] }).atividades[0].descricao).toBe("Concretagem corrigida");
  });

  it("fechamento recusado não cria versão", { timeout: 60_000 }, async () => {
    const { turnoId } = await turnoPronto(false);
    expect((await aplicarAcao(u.cliente, turnoId, "fechar")).ok).toBe(false);
    expect(await versoes(turnoId)).toEqual([]);
  });

  it("o app não grava nem apaga versões", { timeout: 60_000 }, async () => {
    const { turnoId, obraId } = await turnoPronto();
    exigir(await aplicarAcao(u.cliente, turnoId, "fechar"));
    const [antes] = await versoes(turnoId);
    const ins = await u.cliente.from("rdo_versoes").insert({ turno_id: turnoId, obra_id: obraId, numero: 9, emitido_em: new Date().toISOString(), dados: {} });
    expect(ins.error).not.toBeNull();
    const upd = await u.cliente.from("rdo_versoes").update({ numero: 9 }).eq("id", antes.id);
    expect(upd.error).not.toBeNull();
    const del = await u.cliente.from("rdo_versoes").delete().eq("id", antes.id);
    expect(del.error).not.toBeNull();
    expect(await versoes(turnoId)).toEqual([antes]);
  });

  it("outra empresa não lê versões", { timeout: 60_000 }, async () => {
    const { turnoId } = await turnoPronto();
    exigir(await aplicarAcao(u.cliente, turnoId, "fechar"));
    const dono = await u.cliente.from("rdo_versoes").select("id").eq("turno_id", turnoId);
    expect(dono.data).toHaveLength(1);
    const alheio = await outro.cliente.from("rdo_versoes").select("id").eq("turno_id", turnoId);
    expect(alheio.data).toEqual([]);
  });

  it("foto_rdo devolve a mesma foto do gatilho", { timeout: 60_000 }, async () => {
    const { turnoId } = await turnoPronto();
    exigir(await aplicarAcao(u.cliente, turnoId, "fechar"));
    const [v1] = await versoes(turnoId);
    const { data, error } = await criarClienteAdmin().rpc("foto_rdo", { p_turno_id: turnoId });
    expect(error).toBeNull();
    expect(data).toEqual(v1.dados);
    const negado = await u.cliente.rpc("foto_rdo", { p_turno_id: turnoId });
    expect(negado.error).not.toBeNull();
  });

  it("removerTurno recusa turno reaberto com versão", { timeout: 60_000 }, async () => {
    const { turnoId } = await turnoPronto();
    exigir(await aplicarAcao(u.cliente, turnoId, "fechar"));
    exigir(await aplicarAcao(u.cliente, turnoId, "reabrir"));
    expect((await removerTurno(u.cliente, turnoId)).ok).toBe(false);
    expect(await versoes(turnoId)).toHaveLength(1);
  });
});
