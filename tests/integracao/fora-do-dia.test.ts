import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adicionarAtividade } from "@/lib/db/atividades";
import {
  lancarExtraCampo,
  obterTurnoPorToken,
  opcoesPuxarCampo,
  puxarCampo,
  removerForaDoDiaCampo,
  responsaveisDoTurno,
  salvarExecucao,
} from "@/lib/db/campo";
import { enviarFotoExtraCampo } from "@/lib/db/fotosParada";
import { lancarExtraPlanejador, opcoesPuxarPlanejador, puxarPlanejador, removerForaDoDiaPlanejador } from "@/lib/db/foraDoDia";
import { ERRO_EXTRA_SEM_QTD } from "@/lib/db/mensagens";
import { criarObra } from "@/lib/db/obras";
import { criarRascunho, programarSemana, reabrirSemana, salvarAtividadeProgramada } from "@/lib/db/programacao";
import { criarResponsavel } from "@/lib/db/responsaveis";
import { aplicarAcao, criarTurno } from "@/lib/db/turnos";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, VAZIO, type UsuarioTeste } from "./ajuda";

// JPEG mínimo (cabeçalho SOI + APP0) para passar na checagem de bytes.
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);

describe.skipIf(!ligado)("fora do dia (extra, adiantar, atrasada)", () => {
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
  const turnoEm = (obraId: string, data: string) =>
    criarTurno(u.cliente, { obra_id: obraId, data, periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00" });

  /** Semana 16/11 programada: pintura Qui/Sex (Rita), andaime Seg/Ter (Rita), cabos Sex (Carlos). Turno de quarta liberado. */
  async function cenario() {
    const obra = exigir(await criarObra(u.cliente, { nome: "Obra Fora do Dia" }));
    const rita = exigir(await criarResponsavel(u.cliente, obra.id, { nome: "Rita Alves" })).id;
    const carlos = exigir(await criarResponsavel(u.cliente, obra.id, { nome: "Carlos Pereira" })).id;
    const semana = exigir(await criarRascunho(u.cliente, obra.id, "2026-11-16"));
    const pintura = exigir(await salvarAtividadeProgramada(u.cliente, semana.id, {
      descricao: "Pintura", unidade: "m²", meta: 80, dias: [3, 4], periodo: "diurno", equipe: [], responsavel_id: rita,
    })).id;
    const andaime = exigir(await salvarAtividadeProgramada(u.cliente, semana.id, {
      descricao: "Andaime", unidade: "m³", meta: 10, dias: [0, 1], periodo: "diurno", equipe: [], responsavel_id: rita,
    })).id;
    const cabos = exigir(await salvarAtividadeProgramada(u.cliente, semana.id, {
      descricao: "Cabos", unidade: "m", meta: 60, dias: [4], periodo: "diurno", equipe: [], responsavel_id: carlos,
    })).id;
    exigir(await programarSemana(u.cliente, semana.id));
    const qua = exigir(await turnoEm(obra.id, "2026-11-18"));
    const avulsa = exigir(await adicionarAtividade(u.cliente, qua.id, { descricao: "Limpeza", unidade: "un", qtd_planejada: 1 }));
    await u.cliente.from("atividades").update({ responsavel_id: rita }).eq("id", avulsa.id);
    const l = await aplicarAcao(u.cliente, qua.id, "liberar");
    if (!l.ok || !l.dados.token) throw new Error("liberar");
    return { obraId: obra.id, semanaId: semana.id, rita, carlos, pintura, andaime, cabos, turnoId: qua.id, token: l.dados.token };
  }
  const atividadesDo = async (turnoId: string) =>
    ((await criarClienteAdmin().from("atividades").select("*").eq("turno_id", turnoId)).data ?? []) as Record<string, unknown>[];
  const extra = (p: Record<string, unknown> = {}) => ({
    id: crypto.randomUUID(), descricao: "Troca de iluminação da plataforma 3", unidade: "un", qtd: 12, observacao: null, responsavel_id: null, ...p,
  });

  it("opções e quem aparece em Quem é você?", { timeout: 90_000 }, async () => {
    const c = await cenario();
    const turno = (await obterTurnoPorToken(c.token))!;
    const op = await opcoesPuxarCampo(turno, c.rita);
    expect(op.adiantar.map((o) => o.descricao)).toEqual(["Pintura"]);
    expect(op.atrasadas.map((o) => o.descricao)).toEqual(["Andaime"]);
    expect((await opcoesPuxarCampo(turno, c.carlos)).adiantar.map((o) => o.descricao)).toEqual(["Cabos"]);
    expect((await responsaveisDoTurno(turno)).map((r) => r.nome)).toEqual(["Carlos Pereira", "Rita Alves"]);
    const pl = await opcoesPuxarPlanejador(u.cliente, c.turnoId);
    expect(pl.adiantar.map((o) => o.descricao).sort()).toEqual(["Cabos", "Pintura"]);
  });

  it("lancarExtraCampo cria com criada_por_id; reenvio não duplica; id reusado com outros dados recusa", { timeout: 90_000 }, async () => {
    const c = await cenario();
    const d = extra({ solicitado_por: "Marcos, fiscal", extra_pessoas: 3, extra_horas: 1.5, materiais: [{ item: "cabo", quantidade: 10, unidade: "m" }] });
    expect(await lancarExtraCampo(c.token, d, c.carlos)).toEqual({ ok: true, dados: { id: d.id } });
    expect(await lancarExtraCampo(c.token, d, c.carlos)).toEqual({ ok: true, dados: { id: d.id } });
    const ats = (await atividadesDo(c.turnoId)).filter((a) => a.tipo === "extra");
    expect(ats).toHaveLength(1);
    expect(ats[0]).toMatchObject({ id: d.id, criada_por_id: c.carlos, responsavel_id: c.carlos, solicitado_por: "Marcos, fiscal", extra_pessoas: 3, materiais: [{ item: "cabo", quantidade: 10, unidade: "m" }] });
    expect(Number(ats[0].extra_horas)).toBe(1.5);
    expect(Number(ats[0].qtd_realizada)).toBe(12);
    expect((await lancarExtraCampo(c.token, { ...d, qtd: 5 }, c.carlos)).ok).toBe(false);
  });

  it("puxar de outro responsável recusa; puxar duas vezes não duplica", { timeout: 90_000 }, async () => {
    const c = await cenario();
    expect((await puxarCampo(c.token, c.cabos, "adiantar", c.rita)).ok).toBe(false);
    expect((await puxarCampo(c.token, c.pintura, "atrasada", c.rita)).ok).toBe(false);
    expect((await puxarCampo(c.token, c.pintura, "adiantar", c.rita)).ok).toBe(true);
    expect((await puxarCampo(c.token, c.pintura, "adiantar", c.rita)).ok).toBe(true);
    const ad = (await atividadesDo(c.turnoId)).filter((a) => a.programacao_atividade_id === c.pintura);
    expect(ad).toHaveLength(1);
    expect(ad[0]).toMatchObject({ tipo: "adiantada", criada_por_id: c.rita, responsavel_id: c.rita });
    expect(Number(ad[0].qtd_planejada)).toBe(80);
    exigir(await puxarCampo(c.token, c.andaime, "atrasada", c.rita));
    const at = (await atividadesDo(c.turnoId)).find((a) => a.programacao_atividade_id === c.andaime)!;
    expect(at.tipo).toBeNull();
    expect(Number(at.qtd_planejada)).toBe(10);
  });

  it("remover só o que criou", { timeout: 90_000 }, async () => {
    const c = await cenario();
    const d = extra();
    exigir(await lancarExtraCampo(c.token, d, c.carlos));
    expect((await removerForaDoDiaCampo(c.token, d.id, c.rita)).ok).toBe(false);
    expect((await atividadesDo(c.turnoId)).some((a) => a.id === d.id)).toBe(true);
    expect((await removerForaDoDiaCampo(c.token, d.id, c.carlos)).ok).toBe(true);
    expect((await atividadesDo(c.turnoId)).some((a) => a.id === d.id)).toBe(false);
  });

  it("salvarExecucao em adiantada reajusta a cópia de quinta", { timeout: 90_000 }, async () => {
    const c = await cenario();
    const qui = exigir(await turnoEm(c.obraId, "2026-11-19"));
    const copia = () => atividadesDo(qui.id).then((xs) => xs.find((a) => a.programacao_atividade_id === c.pintura));
    expect(Number((await copia())!.qtd_planejada)).toBe(40);
    exigir(await puxarCampo(c.token, c.pintura, "adiantar", c.rita));
    const ad = (await atividadesDo(c.turnoId)).find((a) => a.programacao_atividade_id === c.pintura)!;
    exigir(await salvarExecucao(c.token, ad.id as string, { qtd_realizada: 50, causa: null, observacao: null }, VAZIO, c.rita));
    expect(Number((await copia())!.qtd_planejada)).toBe(30);
    exigir(await salvarExecucao(c.token, ad.id as string, { qtd_realizada: 80, causa: null, observacao: null }, { qtd_realizada: 50, causa: null, observacao: null }, c.rita));
    expect(await copia()).toBeUndefined();
  });

  it("salvarExecucao em extra: zerar recusa; mudar quantidade acompanha", { timeout: 90_000 }, async () => {
    const c = await cenario();
    const d = extra();
    exigir(await lancarExtraCampo(c.token, d, c.carlos));
    const r = await salvarExecucao(c.token, d.id, { qtd_realizada: null, causa: null, observacao: null }, { qtd_realizada: 12, causa: null, observacao: null }, c.carlos);
    expect(r).toEqual({ ok: false, erro: ERRO_EXTRA_SEM_QTD });
    exigir(await salvarExecucao(c.token, d.id, { qtd_realizada: 15, causa: null, observacao: null }, { qtd_realizada: 12, causa: null, observacao: null }, c.carlos));
    const at = (await atividadesDo(c.turnoId)).find((a) => a.id === d.id)!;
    expect(Number(at.qtd_planejada)).toBe(15);
  });

  it("planejador lança extra e adianta", { timeout: 90_000 }, async () => {
    const c = await cenario();
    const d = extra({ responsavel_id: c.carlos });
    exigir(await lancarExtraPlanejador(u.cliente, c.turnoId, d));
    exigir(await puxarPlanejador(u.cliente, c.turnoId, c.cabos, "adiantar"));
    const ats = await atividadesDo(c.turnoId);
    expect(ats.find((a) => a.id === d.id)).toMatchObject({ tipo: "extra", criada_por_id: null, responsavel_id: c.carlos });
    expect(ats.find((a) => a.programacao_atividade_id === c.cabos)).toMatchObject({ tipo: "adiantada", responsavel_id: c.carlos });
  });

  it("foto de extra grava foto_path", { timeout: 90_000 }, async () => {
    const c = await cenario();
    const d = extra();
    exigir(await lancarExtraCampo(c.token, d, c.carlos));
    const form = new FormData();
    form.set("foto", new File([JPEG], "f.jpg", { type: "image/jpeg" }));
    exigir(await enviarFotoExtraCampo(c.token, d.id, c.carlos, form));
    const at = (await atividadesDo(c.turnoId)).find((a) => a.id === d.id)!;
    expect(String(at.foto_path)).toMatch(new RegExp(`/${c.turnoId}/extra-${d.id}\\.jpg$`));
    expect((await enviarFotoExtraCampo(c.token, d.id, c.rita, form)).ok).toBe(false);
  });

  it("semana reaberta: editar a atividade adiantada ou atrasada salva", { timeout: 90_000 }, async () => {
    const c = await cenario();
    exigir(await puxarCampo(c.token, c.pintura, "adiantar", c.rita));
    exigir(await puxarCampo(c.token, c.andaime, "atrasada", c.rita));
    exigir(await reabrirSemana(u.cliente, c.semanaId, "ajustar metas"));
    exigir(await salvarAtividadeProgramada(u.cliente, c.semanaId, {
      descricao: "Pintura", unidade: "m²", meta: 100, dias: [3, 4], periodo: "diurno", equipe: [], responsavel_id: c.rita,
    }, c.pintura));
    exigir(await salvarAtividadeProgramada(u.cliente, c.semanaId, {
      descricao: "Andaime", unidade: "m³", meta: 12, dias: [0, 1], periodo: "diurno", equipe: [], responsavel_id: c.rita,
    }, c.andaime));
  });

  it("planejador remove a atrasada que puxou por engano", { timeout: 90_000 }, async () => {
    const c = await cenario();
    exigir(await puxarPlanejador(u.cliente, c.turnoId, c.andaime, "atrasada"));
    const at = (await atividadesDo(c.turnoId)).find((a) => a.programacao_atividade_id === c.andaime)!;
    expect(at.puxada).toBe(true);
    exigir(await removerForaDoDiaPlanejador(u.cliente, c.turnoId, at.id as string));
    expect((await atividadesDo(c.turnoId)).some((a) => a.id === at.id)).toBe(false);
  });
});
