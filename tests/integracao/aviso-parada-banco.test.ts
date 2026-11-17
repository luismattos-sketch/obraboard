import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adicionarAtividade } from "@/lib/db/atividades";
import { criarObra } from "@/lib/db/obras";
import { aplicarAcao, criarTurno } from "@/lib/db/turnos";
import { salvarEfetivoPlanejador, salvarExecucaoPlanejador } from "@/lib/db/execucao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, VAZIO, type UsuarioTeste } from "./ajuda";

describe.skipIf(!ligado)("aviso de parada no banco", () => {
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
  async function cenario() {
    const o = exigir(await criarObra(u.cliente, { nome: "Obra Parada" }));
    const t = exigir(await criarTurno(u.cliente, {
      obra_id: o.id, data: "2026-11-16", periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00",
    }));
    const joao = await responsavel(o.id, "João");
    const carlos = await responsavel(o.id, "Carlos");
    return { obraId: o.id, turnoId: t.id, joao, carlos };
  }
  const parado = (turnoId: string, resp: string, extra: Record<string, unknown> = {}) =>
    u.cliente.from("efetivo_ocorrencias").insert({
      turno_id: turnoId, responsavel_id: resp, funcao: "Mecânico", tipo: "parado", quantidade: 2,
      hora_inicio: "10:40", hora_fim: null, causa: "atividade_predecessora", ...extra,
    }).select("id").single();

  it("parada aberta (sem fim) com observação e equipe aguardada é aceita", async () => {
    const c = await cenario();
    const r = await parado(c.turnoId, c.joao, { observacao: "rolamento 6312", aguardando_responsavel_id: c.carlos });
    expect(r.error).toBeNull();
    const { data } = await u.cliente.from("efetivo_ocorrencias").select("avisado_em, hora_fim").eq("id", r.data!.id).single();
    expect(data!.hora_fim).toBeNull();
    expect(data!.avisado_em).toBeTruthy();
  });

  it("parada sem causa é recusada", async () => {
    const c = await cenario();
    expect((await parado(c.turnoId, c.joao, { causa: null })).error?.code).toBe("23514");
  });

  it("observação só em parada", async () => {
    const c = await cenario();
    const { error } = await u.cliente.from("efetivo_ocorrencias").insert({
      turno_id: c.turnoId, responsavel_id: c.joao, funcao: "Mecânico", tipo: "saida", quantidade: 1, hora_inicio: "15:00", observacao: "x",
    });
    expect(error?.code).toBe("23514");
  });

  it("equipe aguardada só com a causa Aguardando outra equipe", async () => {
    const c = await cenario();
    expect((await parado(c.turnoId, c.joao, { causa: "material", aguardando_responsavel_id: c.carlos })).error?.code).toBe("23514");
  });

  it("equipe aguardada de outra obra é recusada", async () => {
    const c = await cenario();
    const outra = await cenario();
    expect((await parado(c.turnoId, c.joao, { aguardando_responsavel_id: outra.carlos })).error?.message).toBe("responsavel_invalido");
  });

  it("observação acima de 500 caracteres é recusada", async () => {
    const c = await cenario();
    expect((await parado(c.turnoId, c.joao, { observacao: "x".repeat(501) })).error?.code).toBe("23514");
  });

  it("número de WhatsApp da obra só com dígitos", async () => {
    const c = await cenario();
    expect((await u.cliente.from("obras").update({ whatsapp_planejador: "5511988887777" }).eq("id", c.obraId)).error).toBeNull();
    expect((await u.cliente.from("obras").update({ whatsapp_planejador: "(11) 9888" }).eq("id", c.obraId)).error?.code).toBe("23514");
  });

  it("terminados: único por equipe, gravado na foto do RDO e bloqueado com turno fechado", async () => {
    const c = await cenario();
    const at = exigir(await adicionarAtividade(u.cliente, c.turnoId, { descricao: "Bomba", unidade: "un", qtd_planejada: 1 }));
    exigir(await aplicarAcao(u.cliente, c.turnoId, "liberar"));
    exigir(await salvarEfetivoPlanejador(u.cliente, c.turnoId, c.joao, [{ funcao: "Mecânico", quantidade: 3 }], []));
    const terminou = () => u.cliente.from("turno_equipes_terminadas").insert({ turno_id: c.turnoId, responsavel_id: c.joao, terminou_em: "15:20" });
    expect((await terminou()).error).toBeNull();
    expect((await terminou()).error?.code).toBe("23505");
    expect((await parado(c.turnoId, c.joao, { observacao: "peça", hora_fim: "13:15" })).error).toBeNull();
    exigir(await salvarExecucaoPlanejador(u.cliente, c.turnoId, at.id, { qtd_realizada: 1, causa: null, observacao: null }, VAZIO));
    exigir(await aplicarAcao(u.cliente, c.turnoId, "fechar"));

    const del = await u.cliente.from("turno_equipes_terminadas").delete().eq("turno_id", c.turnoId).select("turno_id");
    expect(del.error?.message).toBe("turno_fechado");

    const { data } = await criarClienteAdmin().from("rdo_versoes").select("dados").eq("turno_id", c.turnoId);
    const dados = data![0].dados;
    expect(dados.terminados).toEqual([{ responsavel_id: c.joao, terminou_em: "15:20:00" }]);
    expect(dados.ocorrencias[0]).toMatchObject({ observacao: "peça", aguardando_responsavel_id: null, foto_path: null });
    expect(dados.ocorrencias[0].avisado_em).toBeTruthy();
  }, 30_000);
});
