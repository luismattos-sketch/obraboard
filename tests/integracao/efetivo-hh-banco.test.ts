import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adicionarAtividade } from "@/lib/db/atividades";
import { criarObra } from "@/lib/db/obras";
import { aplicarAcao, criarTurno } from "@/lib/db/turnos";
import { salvarEfetivoPlanejador, salvarExecucaoPlanejador } from "@/lib/db/execucao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, VAZIO, type UsuarioTeste } from "./ajuda";

describe.skipIf(!ligado)("efetivo e HH no banco", () => {
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
  async function responsavel(obraId: string, nome: string): Promise<string> {
    const { data, error } = await u.cliente.from("responsaveis").insert({ obra_id: obraId, nome }).select("id").single();
    if (error || !data) throw new Error(`responsavel: ${error?.message}`);
    return data.id as string;
  }
  async function cenario(periodo: "diurno" | "noturno" = "diurno") {
    const o = exigir(await criarObra(u.cliente, { nome: "Obra HH" }));
    const t = exigir(await criarTurno(u.cliente, {
      obra_id: o.id, data: "2026-11-16", periodo, hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00",
    }));
    const rita = await responsavel(o.id, "Rita");
    const ana = await responsavel(o.id, "Ana");
    return { obraId: o.id, turnoId: t.id, rita, ana };
  }
  const inserir = (linha: Record<string, unknown>) =>
    u.cliente.from("efetivo_ocorrencias").insert(linha).select("id").single();
  const emprestimo = (turnoId: string, de: string, para: string) =>
    inserir({ turno_id: turnoId, responsavel_id: de, funcao: "Montador", tipo: "emprestimo", quantidade: 2, hora_inicio: "13:00", destino_responsavel_id: para });

  it("turno novo diurno herda 12:00–13:00 da obra", async () => {
    const c = await cenario();
    const { data } = await u.cliente.from("turnos").select("intervalo_inicio, intervalo_fim").eq("id", c.turnoId).single();
    expect(data).toEqual({ intervalo_inicio: "12:00:00", intervalo_fim: "13:00:00" });
  });

  it("noturno herda 00:00–01:00", async () => {
    const c = await cenario("noturno");
    const { data } = await u.cliente.from("turnos").select("intervalo_inicio, intervalo_fim").eq("id", c.turnoId).single();
    expect(data).toEqual({ intervalo_inicio: "00:00:00", intervalo_fim: "01:00:00" });
  });

  it("empréstimo para a própria equipe é recusado", async () => {
    const c = await cenario();
    const { error } = await emprestimo(c.turnoId, c.rita, c.rita);
    expect(error?.code).toBe("23514");
  });

  it("parado sobre empréstimo de outra equipe é recusado", async () => {
    const c = await cenario();
    const o = await responsavel(c.obraId, "Outro");
    const emp = await emprestimo(c.turnoId, c.rita, c.ana);
    expect(emp.error).toBeNull();
    const { error } = await inserir({
      turno_id: c.turnoId, responsavel_id: o, funcao: "Montador", tipo: "parado", quantidade: 1,
      hora_inicio: "14:00", hora_fim: "15:00", causa: "material", emprestimo_id: emp.data!.id,
    });
    expect(error?.message).toBe("ocorrencia_invalida");
  });

  it("remover empréstimo remove as ocorrências penduradas", async () => {
    const c = await cenario();
    const emp = await emprestimo(c.turnoId, c.rita, c.ana);
    const par = await inserir({
      turno_id: c.turnoId, responsavel_id: c.ana, funcao: "Montador", tipo: "parado", quantidade: 1,
      hora_inicio: "14:00", hora_fim: "15:00", causa: "material", emprestimo_id: emp.data!.id,
    });
    expect(par.error).toBeNull();
    await u.cliente.from("efetivo_ocorrencias").delete().eq("id", emp.data!.id);
    const { data } = await u.cliente.from("efetivo_ocorrencias").select("id").eq("turno_id", c.turnoId);
    expect(data).toEqual([]);
  });

  it("destino de outra obra é recusado", async () => {
    const c = await cenario();
    const o2 = exigir(await criarObra(u.cliente, { nome: "Outra" }));
    const alheio = await responsavel(o2.id, "Alheio");
    const { error } = await emprestimo(c.turnoId, c.rita, alheio);
    expect(error?.message).toBe("responsavel_invalido");
  });

  it("ocorrência em turno fechado é recusada e a foto do RDO a inclui", async () => {
    const c = await cenario();
    const at = exigir(await adicionarAtividade(u.cliente, c.turnoId, { descricao: "Andaime", unidade: "m³", qtd_planejada: 10 }));
    exigir(await aplicarAcao(u.cliente, c.turnoId, "liberar"));
    exigir(await salvarEfetivoPlanejador(u.cliente, c.turnoId, c.rita, [{ funcao: "Montador", quantidade: 6 }], []));
    expect((await emprestimo(c.turnoId, c.rita, c.ana)).error).toBeNull();
    exigir(await salvarExecucaoPlanejador(u.cliente, c.turnoId, at.id, { qtd_realizada: 10, causa: null, observacao: null }, VAZIO));
    exigir(await aplicarAcao(u.cliente, c.turnoId, "fechar"));

    const { error } = await emprestimo(c.turnoId, c.rita, c.ana);
    expect(error?.message).toBe("turno_fechado");

    const { data } = await criarClienteAdmin().from("rdo_versoes").select("dados").eq("turno_id", c.turnoId);
    const dados = data![0].dados;
    expect(dados.turno.intervalo_inicio).toBe("12:00:00");
    expect(dados.ocorrencias).toHaveLength(1);
    expect(dados.ocorrencias[0]).toMatchObject({ tipo: "emprestimo", quantidade: 2, destino_responsavel_id: c.ana });
  }, 30_000);
});
