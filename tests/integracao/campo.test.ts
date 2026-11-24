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
  responsaveisDoTurno,
  salvarHorarioReal,
} from "@/lib/db/campo";
import { hashToken } from "@/lib/dominio/token";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, VAZIO, type UsuarioTeste } from "./ajuda";

const LINK_INVALIDO = "Link inválido ou substituído. Peça um novo link ao planejador.";
const FECHADO = "Este turno não está aberto para lançamentos.";
const ERRO_ENVIO_POR_TERMINEI = "Este turno é enviado quando todos os responsáveis tocam “Terminei minha parte”.";
const ERRO_HORARIO_POR_INICIAR = "O horário deste turno sai do “Iniciar turno” e do “Terminei minha parte” de cada responsável.";
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

    const g1 = { qtd_realizada: 3, causa: "material" as const, observacao: null };
    expect(await salvarExecucao(A.token, A.ids[0], g1, VAZIO)).toEqual({ ok: true, dados: g1 });
    const admin = criarClienteAdmin();
    const { data } = await admin.from("atividades").select("qtd_realizada, causa").eq("id", A.ids[0]).single();
    expect(Number(data!.qtd_realizada)).toBe(3);
    expect(data!.causa).toBe("material");

    // concluída limpa causa, guarda a observação e devolve o que gravou (próximo esperado)
    const c2 = await salvarExecucao(A.token, A.ids[0], { qtd_realizada: 10, causa: "material", observacao: "x" }, g1);
    expect(c2).toEqual({ ok: true, dados: { qtd_realizada: 10, causa: null, observacao: "x" } });
    const { data: d2 } = await admin.from("atividades").select("causa, observacao").eq("id", A.ids[0]).single();
    expect(d2).toEqual({ causa: null, observacao: "x" });
    if (!c2.ok) throw new Error();
    expect((await salvarExecucao(A.token, A.ids[0], { qtd_realizada: 10, causa: null, observacao: null }, c2.dados)).ok).toBe(true);

    expect(await salvarExecucao(A.token, B.ids[0], { qtd_realizada: 1, causa: null, observacao: null }, VAZIO)).toEqual({ ok: false, erro: FORA });
    expect(await salvarExecucao(A.token, A.ids[1], { qtd_realizada: -1, causa: null, observacao: null }, VAZIO)).toMatchObject({ ok: false });
    expect(await salvarExecucao(A.token, A.ids[1], { qtd_realizada: 1, causa: "xx" as never, observacao: null }, VAZIO)).toMatchObject({ ok: false });
    expect(await salvarExecucao(A.token, A.ids[1], { qtd_realizada: 1, causa: null, observacao: null }, { ...VAZIO, qtd_realizada: -1 })).toMatchObject({ ok: false });

    // parcial sem causa
    const p1 = { qtd_realizada: 2, causa: null, observacao: null };
    expect((await salvarExecucao(A.token, A.ids[1], p1, VAZIO)).ok).toBe(true);
    expect(await enviarTurnoCampo(A.token)).toEqual({ ok: false, erro: "Há atividades sem causa informada" });
    expect((await salvarExecucao(A.token, A.ids[1], { qtd_realizada: 2, causa: "clima", observacao: null }, p1)).ok).toBe(true);
    expect(await enviarTurnoCampo(A.token)).toEqual({ ok: true, dados: { status: "enviado" } });
    expect(await enviarTurnoCampo(A.token)).toEqual({ ok: true, dados: { status: "enviado" } });
    // sem responsáveis: horário digitado, ainda editável após enviado
    expect((await salvarHorarioReal(A.token, { hora_inicio_real: "07:00", hora_fim_real: "16:30" })).ok).toBe(true);
    expect(await salvarHorarioReal(A.token, { hora_inicio_real: "7h", hora_fim_real: null })).toMatchObject({ ok: false });

    const novo = await gerarNovoLink(u.cliente, A.turnoId);
    expect(novo.ok).toBe(true);
    expect(await salvarExecucao(A.token, A.ids[0], { qtd_realizada: 1, causa: null, observacao: null }, VAZIO)).toEqual({ ok: false, erro: LINK_INVALIDO });
    expect(await obterTurnoPorToken(A.token)).toBeNull();
  });

  it("aba velha não sobrescreve: conflito com os valores atuais (roteiro da Rita)", { timeout: 60_000 }, async () => {
    const T = await turnoLiberado("2026-12-08", [100]);
    const admin = criarClienteAdmin();
    const a45 = { qtd_realizada: 45, causa: null, observacao: null };
    expect((await salvarExecucao(T.token, T.ids[0], a45, VAZIO)).ok).toBe(true);
    // aba A (atualizada) grava 46
    expect((await salvarExecucao(T.token, T.ids[0], { ...a45, qtd_realizada: 46 }, a45)).ok).toBe(true);
    // aba B ainda vê 45 e mexe só na observação
    const r = await salvarExecucao(T.token, T.ids[0], { qtd_realizada: 45, causa: "material", observacao: "aba velha" }, a45);
    expect(r).toEqual({
      ok: false,
      erro: "Mudou em outra tela (pode ter sido você em outra aba).",
      conflito: { atual: { qtd_realizada: 46, causa: null, observacao: null } },
    });
    const { data } = await admin.from("atividades").select("qtd_realizada, causa, observacao").eq("id", T.ids[0]).single();
    expect({ ...data, qtd_realizada: Number(data!.qtd_realizada) }).toEqual({ qtd_realizada: 46, causa: null, observacao: null });
  });

  it("repetição de um salvamento já gravado (resposta perdida na rede) não é conflito", { timeout: 60_000 }, async () => {
    const T = await turnoLiberado("2026-12-14", [10]);
    const dados = { qtd_realizada: 4, causa: "clima" as const, observacao: " chuva " };
    const gravado = { qtd_realizada: 4, causa: "clima", observacao: "chuva" };
    expect(await salvarExecucao(T.token, T.ids[0], dados, VAZIO)).toEqual({ ok: true, dados: gravado });
    // a tela não recebeu a resposta e repete com o esperado antigo
    expect(await salvarExecucao(T.token, T.ids[0], dados, VAZIO)).toEqual({ ok: true, dados: gravado });
    // concluída: o banco guarda causa nula e a observação; repetir também bate
    const fim = { qtd_realizada: 10, causa: "clima" as const, observacao: "x" };
    expect((await salvarExecucao(T.token, T.ids[0], fim, gravado as never)).ok).toBe(true);
    expect(await salvarExecucao(T.token, T.ids[0], fim, gravado as never)).toEqual({
      ok: true,
      dados: { qtd_realizada: 10, causa: null, observacao: "x" },
    });
  });

  it("decimal e observação com espaços no esperado", { timeout: 60_000 }, async () => {
    const T = await turnoLiberado("2026-12-09", [10]);
    const r1 = await salvarExecucao(T.token, T.ids[0], { qtd_realizada: 2.5, causa: "clima", observacao: "  chuva  " }, VAZIO);
    expect(r1).toEqual({ ok: true, dados: { qtd_realizada: 2.5, causa: "clima", observacao: "chuva" } });
    if (!r1.ok) throw new Error();
    expect((await salvarExecucao(T.token, T.ids[0], { qtd_realizada: 3.75, causa: "clima", observacao: "chuva" }, r1.dados)).ok).toBe(true);
    expect((await salvarExecucao(T.token, T.ids[0], { qtd_realizada: 4, causa: "clima", observacao: "chuva" }, { ...r1.dados, qtd_realizada: 3.75 })).ok).toBe(true);
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

    expect((await salvarClima(C.token, { periodo: "manha", condicao: "bom", impediu: false }, null)).ok).toBe(true);
    expect((await salvarClima(C.token, { periodo: "manha", condicao: "chuva_leve", impediu: true }, null)).ok).toBe(true);
    const t2 = await obterTurnoPorToken(C.token);
    expect(t2?.clima).toMatchObject([{ turno_id: C.turnoId, periodo: "manha", condicao: "chuva_leve", impediu: true, lancado_por_id: null }]);
    expect(t2?.clima[0].lancado_em).toBeTruthy();
    expect(await salvarClima(C.token, { periodo: "dia" as never, condicao: "bom", impediu: false }, null)).toMatchObject({ ok: false });


    await salvarExecucao(C.token, C.ids[0], { qtd_realizada: 4, causa: null, observacao: null }, VAZIO);
    const f = await aplicarAcao(u.cliente, C.turnoId, "fechar");
    expect(f.ok).toBe(true);
    expect(await salvarClima(C.token, { periodo: "tarde", condicao: "bom", impediu: false }, null)).toEqual({ ok: false, erro: FECHADO });
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
    expect(await salvarEfetivo(token, [], [])).toEqual({ ok: false, erro: FECHADO });
    expect(await removerClima(token, "manha")).toEqual({ ok: false, erro: FECHADO });
  });

  describe("por responsável", () => {
    async function cenario(data: string) {
      const T = await turnoLiberado(data, [10, 5]);
      const admin = criarClienteAdmin();
      const ana = (await admin.from("responsaveis").insert({ obra_id: obraId, nome: `Ana ${data}` }).select("id").single()).data!.id as string;
      const bia = (await admin.from("responsaveis").insert({ obra_id: obraId, nome: `Bia ${data}` }).select("id").single()).data!.id as string;
      await admin.from("atividades").update({ responsavel_id: ana }).eq("id", T.ids[0]);
      await admin.from("atividades").update({ responsavel_id: bia }).eq("id", T.ids[1]);
      return { ...T, ana, bia };
    }
    const lancadoPor = async (id: string) =>
      (await criarClienteAdmin().from("atividades").select("lancado_por_id").eq("id", id).single()).data!.lancado_por_id;

    it("campo com responsável salva só a sua equipe", { timeout: 60_000 }, async () => {
      const c = await cenario("2026-12-10");
      expect(await salvarExecucao(c.token, c.ids[1], { qtd_realizada: 5, causa: null, observacao: null }, VAZIO, c.ana)).toEqual({ ok: false, erro: FORA });
      expect(await salvarExecucao(c.token, c.ids[0], { qtd_realizada: 10, causa: null, observacao: null }, VAZIO, c.ana)).toEqual({ ok: true, dados: { qtd_realizada: 10, causa: null, observacao: null } });
      expect(await salvarExecucao(c.token, c.ids[1], { qtd_realizada: 5, causa: null, observacao: null }, { ...VAZIO, qtd_realizada: 99 }, c.ana)).toEqual({ ok: false, erro: FORA });
      expect(await lancadoPor(c.ids[0])).toBe(c.ana);
      expect(await responsaveisDoTurno((await obterTurnoPorToken(c.token))!)).toEqual([
        { id: c.ana, nome: "Ana 2026-12-10", ativo: true },
        { id: c.bia, nome: "Bia 2026-12-10", ativo: true },
      ]);
    });

    it("ver tudo não edita equipe de ninguém nem envia", { timeout: 60_000 }, async () => {
      const c = await cenario("2026-12-11");
      expect(await salvarExecucao(c.token, c.ids[1], { qtd_realizada: 5, causa: null, observacao: null }, VAZIO)).toEqual({ ok: false, erro: FORA });
      expect(await lancadoPor(c.ids[1])).toBeNull();
      expect(await enviarTurnoCampo(c.token)).toEqual({ ok: false, erro: ERRO_ENVIO_POR_TERMINEI });
    });

    it("efetivo do campo por equipe", { timeout: 60_000 }, async () => {
      const c = await cenario("2026-12-12");
      expect((await salvarEfetivo(c.token, [{ funcao: "Pedreiro", quantidade: 2 }], [], c.ana)).ok).toBe(true);
      expect((await salvarEfetivo(c.token, [{ funcao: "Servente", quantidade: 1 }], [], c.bia)).ok).toBe(true);
      const ef = (await obterTurnoPorToken(c.token))!.efetivo.map((e) => [e.funcao, e.responsavel_id]);
      expect(ef).toHaveLength(2);
      expect(ef).toContainEqual(["Pedreiro", c.ana]);
    });

    it("responsável de outra obra no campo", { timeout: 60_000 }, async () => {
      const c = await cenario("2026-12-13");
      const o2 = await criarObra(u.cliente, { nome: "Outra obra campo" });
      if (!o2.ok) throw new Error(o2.erro);
      const alheio = (await criarClienteAdmin().from("responsaveis").insert({ obra_id: o2.dados.id, nome: "Zé" }).select("id").single()).data!.id as string;
      expect((await salvarExecucao(c.token, c.ids[0], { qtd_realizada: 1, causa: null, observacao: null }, VAZIO, alheio)).ok).toBe(false);
      expect((await salvarEfetivo(c.token, [{ funcao: "Pedreiro", quantidade: 1 }], [], alheio)).ok).toBe(false);
    });

    it("clima pelo responsável guarda o autor; horário digitado recusado com responsáveis", { timeout: 60_000 }, async () => {
      const c = await cenario("2026-12-15");
      expect((await salvarClima(c.token, { periodo: "manha", condicao: "bom", impediu: false }, c.ana)).ok).toBe(true);
      expect((await obterTurnoPorToken(c.token))!.clima).toMatchObject([{ periodo: "manha", lancado_por_id: c.ana }]);
      expect((await salvarClima(c.token, { periodo: "manha", condicao: "chuva_forte", impediu: true }, c.bia)).ok).toBe(true);
      expect((await obterTurnoPorToken(c.token))!.clima).toMatchObject([{ condicao: "chuva_forte", lancado_por_id: c.bia }]);
      expect(await salvarHorarioReal(c.token, { hora_inicio_real: "07:00", hora_fim_real: null })).toEqual({ ok: false, erro: ERRO_HORARIO_POR_INICIAR });
    });
  });
});
