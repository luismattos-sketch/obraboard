import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarObra } from "@/lib/db/obras";
import { adicionarAtividade } from "@/lib/db/atividades";
import { aplicarAcao, criarTurno, gerarNovoLink, obterTurnoCompleto } from "@/lib/db/turnos";
import { hashToken } from "@/lib/dominio/token";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

describe.skipIf(!ligado)("liberar turno e link", () => {
  let u: UsuarioTeste;
  let obraId: string;
  beforeAll(async () => {
    u = await criarUsuarioTeste();
    const o = await criarObra(u.cliente, { nome: "Obra L" });
    if (!o.ok) throw new Error(o.erro);
    obraId = o.dados.id;
  });
  afterAll(async () => {
    if (u) await removerUsuarioTeste(u.userId);
  });

  const novoTurno = async (data: string) => {
    const r = await criarTurno(u.cliente, { obra_id: obraId, data, periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00" });
    if (!r.ok) throw new Error(r.erro);
    return r.dados;
  };

  it("liberar, gerar novo link, enviar, fechar, reabrir", { timeout: 90_000 }, async () => {
    const t = await novoTurno("2026-11-10");
    expect(await gerarNovoLink(u.cliente, t.id)).toEqual({
      ok: false,
      erro: "Só é possível gerar link para turno em campo ou enviado.",
    });
    expect(await aplicarAcao(u.cliente, t.id, "liberar")).toEqual({
      ok: false,
      erro: "Adicione ao menos uma atividade",
    });
    const a = await adicionarAtividade(u.cliente, t.id, { descricao: "X", unidade: "m", qtd_planejada: 10 });
    if (!a.ok) throw new Error(a.erro);

    const r = await aplicarAcao(u.cliente, t.id, "liberar");
    if (!r.ok) throw new Error(r.erro);
    expect(r.dados.status).toBe("em_campo");
    expect(r.dados.token).toHaveLength(43);
    const t1 = await obterTurnoCompleto(u.cliente, t.id);
    expect(t1?.token_hash).toBe(hashToken(r.dados.token!));

    // liberar de novo não é permitido
    expect((await aplicarAcao(u.cliente, t.id, "liberar")).ok).toBe(false);

    const n = await gerarNovoLink(u.cliente, t.id);
    if (!n.ok) throw new Error(n.erro);
    const t2 = await obterTurnoCompleto(u.cliente, t.id);
    expect(t2?.token_hash).toBe(hashToken(n.dados.token));
    expect(t2?.token_hash).not.toBe(t1?.token_hash);

    // enviar sem causa informada falha (atividade não concluída)
    expect((await aplicarAcao(u.cliente, t.id, "enviar")).ok).toBe(false);
    // concluir atividade e enviar
    await u.cliente.from("atividades").update({ qtd_realizada: 10 }).eq("id", a.dados.id);
    const e = await aplicarAcao(u.cliente, t.id, "enviar");
    expect(e).toEqual({ ok: true, dados: { status: "enviado" } });
    const t3 = await obterTurnoCompleto(u.cliente, t.id);
    expect(t3?.enviado_em).not.toBeNull();
    expect((await gerarNovoLink(u.cliente, t.id)).ok).toBe(true);

    const f = await aplicarAcao(u.cliente, t.id, "fechar");
    expect(f).toEqual({ ok: true, dados: { status: "fechado" } });
    const t4 = await obterTurnoCompleto(u.cliente, t.id);
    expect(t4?.fechado_em).not.toBeNull();
    expect((await gerarNovoLink(u.cliente, t.id)).ok).toBe(false);

    const hashAntes = t4?.token_hash;
    const re = await aplicarAcao(u.cliente, t.id, "reabrir");
    expect(re).toEqual({ ok: true, dados: { status: "enviado" } });
    const t5 = await obterTurnoCompleto(u.cliente, t.id);
    expect(t5?.fechado_em).toBeNull();
    expect(t5?.token_hash).toBe(hashAntes);
  });

  it("turno inexistente", { timeout: 60_000 }, async () => {
    const r = await aplicarAcao(u.cliente, crypto.randomUUID(), "liberar");
    expect(r.ok).toBe(false);
  });
});
