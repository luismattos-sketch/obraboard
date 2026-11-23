import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { adicionarAtividade } from "@/lib/db/atividades";
import { ERRO_LINK } from "@/lib/db/campo";
import { ERRO_IA_INDISPONIVEL, ERRO_LIMITE_IA, ERRO_RELATO_TAMANHO, ERRO_RESPONSAVEL_INVALIDO } from "@/lib/db/mensagens";
import { lancarRelatoCampo, organizarRelatoCampo } from "@/lib/db/relatoCampo";
import { criarObra } from "@/lib/db/obras";
import { gravarTentativa, LIMITE_TENTATIVAS, marcarLancado, relatoPendente, relatosDoTurno } from "@/lib/db/relatos";
import { aplicarAcao, criarTurno } from "@/lib/db/turnos";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

describe.skipIf(!ligado)("relatos do campo (texto do Conte como foi o dia)", () => {
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

  async function cenario() {
    const o = await criarObra(u.cliente, { nome: "Obra Relatos" });
    if (!o.ok) throw new Error(o.erro);
    const t = await criarTurno(u.cliente, {
      obra_id: o.dados.id, data: "2026-11-22", periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00",
    });
    if (!t.ok) throw new Error(t.erro);
    const { data: ana } = await u.cliente.from("responsaveis").insert({ obra_id: o.dados.id, nome: "Ana" }).select("id").single();
    const { data: joao } = await u.cliente.from("responsaveis").insert({ obra_id: o.dados.id, nome: "João" }).select("id").single();
    const a = await adicionarAtividade(u.cliente, t.dados.id, { descricao: "Tubulação linha 3", unidade: "m", qtd_planejada: 50 });
    if (!a.ok) throw new Error(a.erro);
    const b = await adicionarAtividade(u.cliente, t.dados.id, { descricao: "Suporte de tubo", unidade: "un", qtd_planejada: 8 });
    if (!b.ok) throw new Error(b.erro);
    await criarClienteAdmin().from("atividades").update({ responsavel_id: ana!.id }).eq("id", a.dados.id);
    await criarClienteAdmin().from("atividades").update({ responsavel_id: joao!.id }).eq("id", b.dados.id);
    const l = await aplicarAcao(u.cliente, t.dados.id, "liberar");
    if (!l.ok || !l.dados.token) throw new Error("liberar");
    return { turnoId: t.dados.id, token: l.dados.token, ana: ana!.id as string, joao: joao!.id as string, tubo: a.dados.id, suporte: b.dados.id };
  }

  it("cria, atualiza a mesma rodada e abre outra depois de lançar", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const r1 = await gravarTentativa(c.turnoId, c.ana, "fizemos 30 m", null);
    if (!r1.ok) throw new Error(r1.erro);
    expect(r1.dados.tentativas).toBe(1);
    const r2 = await gravarTentativa(c.turnoId, c.ana, "fizemos 35 m", r1.dados.id);
    expect(r2).toEqual({ ok: true, dados: { id: r1.dados.id, tentativas: 2 } });
    expect((await relatoPendente(c.turnoId, c.ana))?.texto).toBe("fizemos 35 m");
    expect((await marcarLancado(c.turnoId, c.ana, r1.dados.id)).ok).toBe(true);
    expect(await relatoPendente(c.turnoId, c.ana)).toBeNull();
    const r3 = await gravarTentativa(c.turnoId, c.ana, "mais 5 m", r1.dados.id);
    if (!r3.ok) throw new Error(r3.erro);
    expect(r3.dados.id).not.toBe(r1.dados.id);
    expect(r3.dados.tentativas).toBe(1);
  });

  it("relato de outro responsável não é reaproveitado", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const r1 = await gravarTentativa(c.turnoId, c.ana, "texto da Ana", null);
    if (!r1.ok) throw new Error(r1.erro);
    const r2 = await gravarTentativa(c.turnoId, c.joao, "texto do João", r1.dados.id);
    if (!r2.ok) throw new Error(r2.erro);
    expect(r2.dados.id).not.toBe(r1.dados.id);
    expect((await relatoPendente(c.turnoId, c.ana))?.texto).toBe("texto da Ana");
  });

  it("limite de tentativas por responsável no turno", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const r = await gravarTentativa(c.turnoId, c.ana, "x", null);
    if (!r.ok) throw new Error(r.erro);
    await criarClienteAdmin().from("relatos_campo").update({ tentativas: LIMITE_TENTATIVAS }).eq("id", r.dados.id);
    expect(await gravarTentativa(c.turnoId, c.ana, "y", r.dados.id)).toEqual({ ok: false, erro: ERRO_LIMITE_IA });
    expect(await gravarTentativa(c.turnoId, c.ana, "y", null)).toEqual({ ok: false, erro: ERRO_LIMITE_IA });
    expect((await gravarTentativa(c.turnoId, c.joao, "y", null)).ok).toBe(true);
  });

  it("texto vazio ou longo demais", { timeout: 60_000 }, async () => {
    const c = await cenario();
    expect(await gravarTentativa(c.turnoId, c.ana, "   ", null)).toEqual({ ok: false, erro: ERRO_RELATO_TAMANHO });
    expect(await gravarTentativa(c.turnoId, c.ana, "a".repeat(1001), null)).toEqual({ ok: false, erro: ERRO_RELATO_TAMANHO });
  });

  it("planejador lê; outra empresa não; ninguém insere pela sessão", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const r = await gravarTentativa(c.turnoId, c.ana, "fizemos 30 m", null);
    if (!r.ok) throw new Error(r.erro);
    const meus = await relatosDoTurno(u.cliente, c.turnoId);
    expect(meus.map((x) => [x.texto, x.responsavel_id, x.lancado])).toEqual([["fizemos 30 m", c.ana, false]]);
    expect(await relatosDoTurno(outro.cliente, c.turnoId)).toEqual([]);
    const { error } = await u.cliente.from("relatos_campo").insert({ turno_id: c.turnoId, responsavel_id: c.ana, texto: "x" });
    expect(error).not.toBeNull();
  });

  describe("ações do link (IA falsa)", () => {
    beforeAll(() => vi.stubEnv("FRENTIA_IA_FALSA", "1"));
    afterAll(() => vi.unstubAllEnvs());

    it("organizar: grava o texto e devolve a prévia só com as atividades do responsável", { timeout: 60_000 }, async () => {
      const c = await cenario();
      const r = await organizarRelatoCampo(c.token, c.ana, "fizemos 30 m de tubulação, faltou andaime", null);
      if (!r.ok) throw new Error(r.erro);
      expect(r.dados.previa.itens.map((i) => [i.atividadeId, i.depois?.qtd_realizada])).toEqual([[c.tubo, 30]]);
      expect(r.dados.previa.perguntas.map((q) => q.tipo)).toEqual(["causa"]);
      expect(r.dados.previa.semCitar).toEqual([]);
      expect((await relatoPendente(c.turnoId, c.ana))?.id).toBe(r.dados.relatoId);
    });

    it("atividade de outro responsável nunca entra", { timeout: 60_000 }, async () => {
      const c = await cenario();
      const r = await organizarRelatoCampo(c.token, c.ana, "fizemos 3 m de suporte", null);
      if (!r.ok) throw new Error(r.erro);
      expect(r.dados.previa.itens).toEqual([]);
      expect(r.dados.previa.semNada).toBe(true);
    });

    it("responsável de outra obra é recusado", { timeout: 60_000 }, async () => {
      const c = await cenario();
      const d = await cenario();
      expect(await organizarRelatoCampo(c.token, d.ana, "fizemos 30 m de tubulação", null)).toEqual({ ok: false, erro: ERRO_RESPONSAVEL_INVALIDO });
    });

    it("IA fora do ar: avisa e o texto continua guardado", { timeout: 60_000 }, async () => {
      const c = await cenario();
      expect(await organizarRelatoCampo(c.token, c.ana, "ERRO aqui", null)).toEqual({ ok: false, erro: ERRO_IA_INDISPONIVEL });
      expect((await relatoPendente(c.turnoId, c.ana))?.texto).toBe("ERRO aqui");
    });

    it("token inválido", async () => {
      expect(await organizarRelatoCampo("x".repeat(43), "00000000-0000-0000-0000-000000000000", "oi", null)).toEqual({ ok: false, erro: ERRO_LINK });
    });

    it("lançar marca o relato", { timeout: 60_000 }, async () => {
      const c = await cenario();
      const r = await organizarRelatoCampo(c.token, c.ana, "fizemos 30 m de tubulação", null);
      if (!r.ok) throw new Error(r.erro);
      expect((await lancarRelatoCampo(c.token, c.ana, r.dados.relatoId)).ok).toBe(true);
      expect((await relatosDoTurno(u.cliente, c.turnoId))[0].lancado).toBe(true);
    });
  });

  it("turno fechado recusa gravar", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const admin = criarClienteAdmin();
    await admin.from("atividades").update({ qtd_realizada: 50 }).eq("id", c.tubo);
    await admin.from("atividades").update({ qtd_realizada: 8 }).eq("id", c.suporte);
    const { error } = await admin.from("turnos").update({ status: "fechado", fechado_em: new Date().toISOString() }).eq("id", c.turnoId);
    expect(error).toBeNull();
    expect((await gravarTentativa(c.turnoId, c.ana, "x", null)).ok).toBe(false);
  });
});
