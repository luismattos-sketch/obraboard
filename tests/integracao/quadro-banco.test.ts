import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adicionarAtividade } from "@/lib/db/atividades";
import { criarObra } from "@/lib/db/obras";
import { aplicarAcao, criarTurno } from "@/lib/db/turnos";
import { salvarExecucaoPlanejador } from "@/lib/db/execucao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

describe.skipIf(!ligado)("quadro no banco", () => {
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

  async function obra(nome = "Obra Quadro") {
    return exigir(await criarObra(u.cliente, { nome }));
  }
  async function responsavel(obraId: string, nome: string): Promise<string> {
    const { data, error } = await u.cliente.from("responsaveis").insert({ obra_id: obraId, nome }).select("id").single();
    if (error || !data) throw new Error(`responsavel: ${error?.message}`);
    return data.id as string;
  }
  async function turno(obraId: string, data = "2026-11-10") {
    return exigir(await criarTurno(u.cliente, {
      obra_id: obraId, data, periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "16:00",
    }));
  }
  type Linha = { funcao: string; quantidade: number };
  const substituir = (turnoId: string, resp: string | null, esperado: Linha[], linhas: Linha[]) =>
    u.cliente.rpc("substituir_efetivo", { p_turno_id: turnoId, p_responsavel_id: resp, p_esperado: esperado, p_linhas: linhas });

  it("nome duplicado na obra", async () => {
    const o = await obra();
    await responsavel(o.id, "João");
    const { error } = await u.cliente.from("responsaveis").insert({ obra_id: o.id, nome: " joão " });
    expect(error?.code).toBe("23505");
    const o2 = await obra("Outra");
    await expect(responsavel(o2.id, "João")).resolves.toBeTypeOf("string");
  });

  it("responsável de outra obra", async () => {
    const o = await obra();
    const o2 = await obra("Outra");
    const alheio = await responsavel(o2.id, "Alheio");
    const t = await turno(o.id);
    const at = exigir(await adicionarAtividade(u.cliente, t.id, { descricao: "Forma", unidade: "m²", qtd_planejada: 10 }));

    const a = await u.cliente.from("atividades").update({ responsavel_id: alheio }).eq("id", at.id);
    expect(a.error?.message).toBe("responsavel_invalido");
    const e = await u.cliente.from("efetivo").insert({ turno_id: t.id, funcao: "Pedreiro", quantidade: 1, responsavel_id: alheio });
    expect(e.error?.message).toBe("responsavel_invalido");

    const { data: sem } = await u.cliente.from("semanas").insert({ obra_id: o.id, inicio: "2026-11-09" }).select("id").single();
    const p = await u.cliente.from("programacao_atividades").insert({
      semana_id: sem!.id, descricao: "X", meta: 1, dias: [0], responsavel_id: alheio,
    });
    expect(p.error?.message).toBe("responsavel_invalido");
  });

  it("efetivo por equipe", async () => {
    const o = await obra();
    const a = await responsavel(o.id, "Ana");
    const b = await responsavel(o.id, "Bruno");
    const t = await turno(o.id);
    expect((await substituir(t.id, a, [], [{ funcao: "Mecânico", quantidade: 2 }])).error).toBeNull();
    expect((await substituir(t.id, b, [], [{ funcao: "Eletricista", quantidade: 3 }])).error).toBeNull();

    expect((await substituir(t.id, a, [{ funcao: "Mecânico", quantidade: 2 }], [{ funcao: "Soldador", quantidade: 1 }])).error).toBeNull();
    const { data } = await u.cliente.from("efetivo").select("funcao, quantidade, responsavel_id").eq("turno_id", t.id);
    expect(data).toHaveLength(2);
    expect(data).toContainEqual({ funcao: "Soldador", quantidade: 1, responsavel_id: a });
    expect(data).toContainEqual({ funcao: "Eletricista", quantidade: 3, responsavel_id: b });

    // B muda; o esperado desatualizado de A continua sendo conflito.
    expect((await substituir(t.id, b, [{ funcao: "Eletricista", quantidade: 3 }], [{ funcao: "Eletricista", quantidade: 4 }])).error).toBeNull();
    const conflito = await substituir(t.id, a, [{ funcao: "Mecânico", quantidade: 2 }], []);
    expect(conflito.error?.message).toBe("efetivo_conflito");
  });

  it("efetivo legado", async () => {
    const o = await obra();
    const t = await turno(o.id);
    await u.cliente.from("efetivo").insert({ turno_id: t.id, funcao: "Pedreiro", quantidade: 2 });
    const r = await substituir(t.id, null, [{ funcao: "Pedreiro", quantidade: 2 }], [{ funcao: "Pedreiro", quantidade: 3 }]);
    expect(r.error).toBeNull();
    const { data } = await u.cliente.from("efetivo").select("quantidade").eq("turno_id", t.id);
    expect(data).toEqual([{ quantidade: 3 }]);
  });

  it("foto do check-in ao liberar", async () => {
    const o = await obra();
    const a = await responsavel(o.id, "Ana");
    const t = await turno(o.id);
    const at = exigir(await adicionarAtividade(u.cliente, t.id, { descricao: "Forma", unidade: "m²", qtd_planejada: 10 }));
    await u.cliente.from("atividades").update({ responsavel_id: a }).eq("id", at.id);
    await substituir(t.id, a, [], [{ funcao: "Carpinteiro", quantidade: 2 }]);
    exigir(await aplicarAcao(u.cliente, t.id, "liberar"));

    const ler = () => u.cliente.from("checkin_fotos").select("dados").eq("turno_id", t.id);
    const { data } = await ler();
    expect(data).toHaveLength(1);
    const dados = data![0].dados;
    expect(dados.atividades[0].responsavel_id).toBe(a);
    expect(dados.atividades[0].programada).toBe(false);
    expect(dados.responsaveis[0]).toMatchObject({ id: a, nome: "Ana", ativo: true });
    expect(dados.efetivo[0]).toMatchObject({ funcao: "Carpinteiro", quantidade: 2, responsavel_id: a });
    expect(dados.turno.status).toBe("em_campo");

    exigir(await salvarExecucaoPlanejador(u.cliente, t.id, at.id, { qtd_realizada: 10, causa: null, observacao: null }));
    exigir(await aplicarAcao(u.cliente, t.id, "fechar"));
    exigir(await aplicarAcao(u.cliente, t.id, "reabrir", { motivo: "Ajuste de quantidade" }));
    exigir(await aplicarAcao(u.cliente, t.id, "fechar"));
    expect((await ler()).data).toHaveLength(1);
  }, 30_000);

  it("outra empresa não vê responsáveis nem fotos", async () => {
    const o = await obra();
    await responsavel(o.id, "Ana");
    const t = await turno(o.id);
    exigir(await adicionarAtividade(u.cliente, t.id, { descricao: "Forma", unidade: "m²", qtd_planejada: 10 }));
    exigir(await aplicarAcao(u.cliente, t.id, "liberar"));
    const r = await outro.cliente.from("responsaveis").select("id").eq("obra_id", o.id);
    expect(r.data).toEqual([]);
    const f = await outro.cliente.from("checkin_fotos").select("id").eq("turno_id", t.id);
    expect(f.data).toEqual([]);
  });

  it("apagar obra", async () => {
    const o = await obra();
    await responsavel(o.id, "Ana");
    const t = await turno(o.id);
    exigir(await adicionarAtividade(u.cliente, t.id, { descricao: "Forma", unidade: "m²", qtd_planejada: 10 }));
    exigir(await aplicarAcao(u.cliente, t.id, "liberar"));
    const admin = criarClienteAdmin();
    expect((await admin.from("obras").delete().eq("id", o.id)).error).toBeNull();
    expect((await admin.from("responsaveis").select("id").eq("obra_id", o.id)).data).toEqual([]);
    expect((await admin.from("checkin_fotos").select("id").eq("obra_id", o.id)).data).toEqual([]);
  });
});
