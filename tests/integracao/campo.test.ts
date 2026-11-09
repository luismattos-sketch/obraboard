import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarObra } from "@/lib/db/obras";
import { aplicarAcao, criarTurno, gerarNovoLink } from "@/lib/db/turnos";
import { adicionarAtividade } from "@/lib/db/atividades";
import {
  enviarTurnoCampo,
  obterTurnoPorToken,
  removerClima,
  salvarClima,
  salvarEfetivo,
  salvarExecucao,
  salvarHorarioReal,
} from "@/lib/db/campo";
import { hashToken } from "@/lib/dominio/token";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

const LINK_INVALIDO = "Link inválido ou substituído. Peça um novo link ao planejador.";
const FECHADO = "Este turno não está aberto para lançamentos.";
const FORA = "Esta atividade foi removida pelo planejador. Recarregue a página.";

describe.skipIf(!ligado)("campo (token)", () => {
  let u: UsuarioTeste;
  let obraId: string;
  beforeAll(async () => {
    u = await criarUsuarioTeste();
    const o = await criarObra(u.cliente, { nome: "Obra Campo" });
    if (!o.ok) throw new Error(o.erro);
    obraId = o.dados.id;
  });
  afterAll(async () => {
    if (u) await removerUsuarioTeste(u.userId);
  });

  async function turnoLiberado(data: string, qtds: number[]) {
    const t = await criarTurno(u.cliente, {
      obra_id: obraId,
      data,
      periodo: "diurno",
      hora_inicio_prevista: "07:00",
      hora_fim_prevista: "17:00",
    });
    if (!t.ok) throw new Error(t.erro);
    const ids: string[] = [];
    for (const q of qtds) {
      const a = await adicionarAtividade(u.cliente, t.dados.id, { descricao: "A", unidade: "m", qtd_planejada: q });
      if (!a.ok) throw new Error(a.erro);
      ids.push(a.dados.id);
    }
    const l = await aplicarAcao(u.cliente, t.dados.id, "liberar");
    if (!l.ok || !l.dados.token) throw new Error("liberar");
    return { turnoId: t.dados.id, token: l.dados.token, ids };
  }

  it("token inexistente/malformado -> null", { timeout: 60_000 }, async () => {
    expect(await obterTurnoPorToken("token-inexistente")).toBeNull();
    expect(await obterTurnoPorToken("a".repeat(43))).toBeNull();
  });

  it("execução, outro turno, novo link, enviar", { timeout: 60_000 }, async () => {
    const A = await turnoLiberado("2026-12-01", [10, 5]);
    const B = await turnoLiberado("2026-12-02", [10]);
    const turno = await obterTurnoPorToken(A.token);
    expect(turno?.id).toBe(A.turnoId);
    expect(turno?.atividades).toHaveLength(2);

    expect(await salvarExecucao(A.token, A.ids[0], { qtd_realizada: 3, causa: "material", observacao: null })).toEqual({
      ok: true,
      dados: undefined,
    });
    const admin = criarClienteAdmin();
    const { data } = await admin.from("atividades").select("qtd_realizada, causa").eq("id", A.ids[0]).single();
    expect(Number(data!.qtd_realizada)).toBe(3);
    expect(data!.causa).toBe("material");

    // concluída limpa causa
    await salvarExecucao(A.token, A.ids[0], { qtd_realizada: 10, causa: "material", observacao: "x" });
    const { data: d2 } = await admin.from("atividades").select("causa, observacao").eq("id", A.ids[0]).single();
    expect(d2).toEqual({ causa: null, observacao: null });

    expect(await salvarExecucao(A.token, B.ids[0], { qtd_realizada: 1, causa: null, observacao: null })).toEqual({ ok: false, erro: FORA });
    expect(await salvarExecucao(A.token, A.ids[1], { qtd_realizada: -1, causa: null, observacao: null })).toMatchObject({ ok: false });
    expect(await salvarExecucao(A.token, A.ids[1], { qtd_realizada: 1, causa: "xx" as never, observacao: null })).toMatchObject({ ok: false });

    // parcial sem causa
    await salvarExecucao(A.token, A.ids[1], { qtd_realizada: 2, causa: null, observacao: null });
    expect(await enviarTurnoCampo(A.token)).toEqual({ ok: false, erro: "Há atividades sem causa informada" });
    await salvarExecucao(A.token, A.ids[1], { qtd_realizada: 2, causa: "clima", observacao: null });
    expect(await enviarTurnoCampo(A.token)).toEqual({ ok: true, dados: { status: "enviado" } });
    expect(await enviarTurnoCampo(A.token)).toEqual({ ok: true, dados: { status: "enviado" } });
    // ainda editável após enviado
    expect((await salvarHorarioReal(A.token, { hora_inicio_real: "07:00", hora_fim_real: "16:30" })).ok).toBe(true);
    expect(await salvarHorarioReal(A.token, { hora_inicio_real: "7h", hora_fim_real: null })).toMatchObject({ ok: false });

    const novo = await gerarNovoLink(u.cliente, A.turnoId);
    expect(novo.ok).toBe(true);
    expect(await salvarExecucao(A.token, A.ids[0], { qtd_realizada: 1, causa: null, observacao: null })).toEqual({ ok: false, erro: LINK_INVALIDO });
    expect(await obterTurnoPorToken(A.token)).toBeNull();
  });

  it("fechado bloqueia; efetivo substitui", { timeout: 60_000 }, async () => {
    const C = await turnoLiberado("2026-12-03", [4]);
    const pedreiro = [{ funcao: "Pedreiro", quantidade: 4 }];
    expect((await salvarEfetivo(C.token, pedreiro, [])).ok).toBe(true);
    expect((await salvarEfetivo(C.token, pedreiro, pedreiro)).ok).toBe(true);
    expect(await salvarEfetivo(C.token, [{ funcao: " ", quantidade: 4 }], pedreiro)).toMatchObject({ ok: false });
    expect(await salvarEfetivo(C.token, [{ funcao: "X", quantidade: 1.5 }], pedreiro)).toMatchObject({ ok: false });
    const t = await obterTurnoPorToken(C.token);
    expect(t?.efetivo).toHaveLength(1);

    expect((await salvarClima(C.token, { periodo: "manha", condicao: "bom", impediu: false })).ok).toBe(true);
    expect((await salvarClima(C.token, { periodo: "manha", condicao: "chuva_leve", impediu: true })).ok).toBe(true);
    const t2 = await obterTurnoPorToken(C.token);
    expect(t2?.clima).toEqual([{ turno_id: C.turnoId, periodo: "manha", condicao: "chuva_leve", impediu: true }]);
    expect(await salvarClima(C.token, { periodo: "dia" as never, condicao: "bom", impediu: false })).toMatchObject({ ok: false });

    await salvarExecucao(C.token, C.ids[0], { qtd_realizada: 4, causa: null, observacao: null });
    const f = await aplicarAcao(u.cliente, C.turnoId, "fechar");
    expect(f.ok).toBe(true);
    expect(await salvarClima(C.token, { periodo: "tarde", condicao: "bom", impediu: false })).toEqual({ ok: false, erro: FECHADO });
    expect(await salvarEfetivo(C.token, [], pedreiro)).toEqual({ ok: false, erro: FECHADO });
    expect(await obterTurnoPorToken(C.token)).toMatchObject({ status: "fechado" });
  });

  it("turno planejado, mesmo com token_hash, não aceita lançamentos", { timeout: 60_000 }, async () => {
    const t = await criarTurno(u.cliente, { obra_id: obraId, data: "2026-12-04", periodo: "diurno" });
    if (!t.ok) throw new Error(t.erro);
    expect(t.dados.token_hash).toBeNull();
    const token = "p".repeat(43);
    const { error } = await criarClienteAdmin().from("turnos").update({ token_hash: hashToken(token) }).eq("id", t.dados.id);
    expect(error).toBeNull();
    expect(await salvarClima(token, { periodo: "manha", condicao: "bom", impediu: false })).toEqual({ ok: false, erro: FECHADO });
    expect(await salvarEfetivo(token, [], [])).toEqual({ ok: false, erro: FECHADO });
    expect(await removerClima(token, "manha")).toEqual({ ok: false, erro: FECHADO });
  });

  it("removerClima apaga só o período do turno do token", { timeout: 60_000 }, async () => {
    const A = await turnoLiberado("2026-12-05", [4]);
    const B = await turnoLiberado("2026-12-06", [4]);
    await salvarClima(A.token, { periodo: "manha", condicao: "bom", impediu: false });
    await salvarClima(A.token, { periodo: "tarde", condicao: "bom", impediu: false });
    await salvarClima(B.token, { periodo: "manha", condicao: "bom", impediu: false });
    expect((await removerClima(A.token, "manha")).ok).toBe(true);
    expect((await obterTurnoPorToken(A.token))?.clima.map((c) => c.periodo)).toEqual(["tarde"]);
    expect((await obterTurnoPorToken(B.token))?.clima).toHaveLength(1);
    expect(await removerClima(A.token, "dia" as never)).toMatchObject({ ok: false });
  });
});
