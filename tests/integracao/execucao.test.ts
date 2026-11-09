import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adicionarAtividade } from "@/lib/db/atividades";
import {
  removerClimaPlanejador,
  salvarClimaPlanejador,
  salvarEfetivoPlanejador,
  salvarExecucaoPlanejador,
  salvarHorarioPlanejador,
} from "@/lib/db/execucao";
import { criarObra } from "@/lib/db/obras";
import { aplicarAcao, criarTurno, obterTurnoCompleto } from "@/lib/db/turnos";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

const FECHADO = "Turno fechado: reabra para editar";

describe.skipIf(!ligado)("correções do planejador (sessão + RLS)", () => {
  let u: UsuarioTeste;
  let outro: UsuarioTeste;
  let obraId: string;
  beforeAll(async () => {
    u = await criarUsuarioTeste();
    outro = await criarUsuarioTeste();
    const o = await criarObra(u.cliente, { nome: "Obra Execução" });
    if (!o.ok) throw new Error(o.erro);
    obraId = o.dados.id;
  });
  afterAll(async () => {
    if (u) await removerUsuarioTeste(u.userId);
    if (outro) await removerUsuarioTeste(outro.userId);
  });

  async function turnoEmCampo(data: string) {
    const t = await criarTurno(u.cliente, { obra_id: obraId, data, periodo: "diurno" });
    if (!t.ok) throw new Error(t.erro);
    const a = await adicionarAtividade(u.cliente, t.dados.id, { descricao: "A", unidade: "m", qtd_planejada: 10 });
    if (!a.ok) throw new Error(a.erro);
    const l = await aplicarAcao(u.cliente, t.dados.id, "liberar");
    if (!l.ok) throw new Error(l.erro);
    return { turnoId: t.dados.id, atividadeId: a.dados.id };
  }

  it("corrige execução, efetivo, clima e horário; concluída limpa causa", { timeout: 60_000 }, async () => {
    const { turnoId, atividadeId } = await turnoEmCampo("2027-01-10");
    expect((await salvarExecucaoPlanejador(u.cliente, turnoId, atividadeId, { qtd_realizada: 4, causa: "material", observacao: " x " })).ok).toBe(true);
    let t = await obterTurnoCompleto(u.cliente, turnoId);
    expect(t?.atividades[0]).toMatchObject({ qtd_realizada: 4, causa: "material", observacao: "x" });
    await salvarExecucaoPlanejador(u.cliente, turnoId, atividadeId, { qtd_realizada: 10, causa: "material", observacao: "x" });
    t = await obterTurnoCompleto(u.cliente, turnoId);
    expect(t?.atividades[0]).toMatchObject({ qtd_realizada: 10, causa: null, observacao: null });

    expect(await salvarExecucaoPlanejador(u.cliente, turnoId, atividadeId, { qtd_realizada: -1, causa: null, observacao: null })).toMatchObject({ ok: false });
    expect(await salvarExecucaoPlanejador(u.cliente, turnoId, atividadeId, { qtd_realizada: 1, causa: "zz" as never, observacao: null })).toMatchObject({ ok: false });

    expect((await salvarEfetivoPlanejador(u.cliente, turnoId, [{ funcao: "Pedreiro", quantidade: 3 }])).ok).toBe(true);
    expect((await salvarEfetivoPlanejador(u.cliente, turnoId, [{ funcao: "Servente", quantidade: 2 }])).ok).toBe(true);
    expect(await salvarEfetivoPlanejador(u.cliente, turnoId, [{ funcao: "", quantidade: 2 }])).toMatchObject({ ok: false });
    expect((await obterTurnoCompleto(u.cliente, turnoId))?.efetivo.map((e) => e.funcao)).toEqual(["Servente"]);

    expect((await salvarClimaPlanejador(u.cliente, turnoId, { periodo: "manha", condicao: "chuva_leve", impediu: true })).ok).toBe(true);
    expect((await salvarClimaPlanejador(u.cliente, turnoId, { periodo: "tarde", condicao: "bom", impediu: false })).ok).toBe(true);
    expect((await removerClimaPlanejador(u.cliente, turnoId, "manha")).ok).toBe(true);
    expect((await obterTurnoCompleto(u.cliente, turnoId))?.clima.map((c) => c.periodo)).toEqual(["tarde"]);

    expect((await salvarHorarioPlanejador(u.cliente, turnoId, { hora_inicio_real: "07:00", hora_fim_real: "16:00" })).ok).toBe(true);
    expect(await salvarHorarioPlanejador(u.cliente, turnoId, { hora_inicio_real: "7h", hora_fim_real: null })).toMatchObject({ ok: false });
    expect((await obterTurnoCompleto(u.cliente, turnoId))?.hora_inicio_real).toBe("07:00:00");
  });

  it("recusa turno fechado e volta a aceitar ao reabrir", { timeout: 60_000 }, async () => {
    const { turnoId, atividadeId } = await turnoEmCampo("2027-01-11");
    await salvarExecucaoPlanejador(u.cliente, turnoId, atividadeId, { qtd_realizada: 10, causa: null, observacao: null });
    expect((await aplicarAcao(u.cliente, turnoId, "fechar")).ok).toBe(true);
    const e = { ok: false, erro: FECHADO };
    expect(await salvarExecucaoPlanejador(u.cliente, turnoId, atividadeId, { qtd_realizada: 1, causa: null, observacao: null })).toEqual(e);
    expect(await salvarEfetivoPlanejador(u.cliente, turnoId, [])).toEqual(e);
    expect(await salvarClimaPlanejador(u.cliente, turnoId, { periodo: "manha", condicao: "bom", impediu: false })).toEqual(e);
    expect(await removerClimaPlanejador(u.cliente, turnoId, "manha")).toEqual(e);
    expect(await salvarHorarioPlanejador(u.cliente, turnoId, { hora_inicio_real: null, hora_fim_real: null })).toEqual(e);
    expect((await aplicarAcao(u.cliente, turnoId, "reabrir")).ok).toBe(true);
    expect((await salvarEfetivoPlanejador(u.cliente, turnoId, [])).ok).toBe(true);
  });

  it("outra empresa não altera nada (RLS)", { timeout: 60_000 }, async () => {
    const { turnoId, atividadeId } = await turnoEmCampo("2027-01-12");
    expect(await salvarExecucaoPlanejador(outro.cliente, turnoId, atividadeId, { qtd_realizada: 5, causa: null, observacao: null })).toMatchObject({ ok: false });
    expect(await salvarHorarioPlanejador(outro.cliente, turnoId, { hora_inicio_real: "07:00", hora_fim_real: null })).toMatchObject({ ok: false });
    const { data } = await criarClienteAdmin().from("atividades").select("qtd_realizada").eq("id", atividadeId).single();
    expect(data!.qtd_realizada).toBeNull();
  });
});
