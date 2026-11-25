import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { salvarExecucaoPlanejador } from "@/lib/db/execucao";
import { criarObra } from "@/lib/db/obras";
import {
  atualizarMetaTrazida,
  criarRascunho,
  obterDadosSemana,
  programarSemana,
  resumoSemanaAnterior,
  salvarAtividadeProgramada,
} from "@/lib/db/programacao";
import { aplicarAcao, criarTurno } from "@/lib/db/turnos";
import { pendentesDaSemanaAnterior } from "@/lib/dominio/trazerSaldo";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, VAZIO, type UsuarioTeste } from "./ajuda";

// Item 1.6: pintura 120 m² na semana de 09/11/2026 (só segunda); semana de 16/11/2026 traz o saldo.
describe.skipIf(!ligado)("trazer saldo da semana anterior", () => {
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
  const base = { descricao: "Pintura do galpão", unidade: "m²", meta: 120, dias: [0 as const], periodo: "diurno" as const, equipe: [] };

  async function atividadeDoTurno(turnoId: string) {
    const { data, error } = await u.cliente.from("atividades").select("id").eq("turno_id", turnoId).single();
    if (error) throw new Error(error.message);
    return data.id as string;
  }

  /** Lança `qtd` na segunda 09/11 e fecha o turno (causa se não concluiu). Reabre se já fechado. */
  async function lancar(obraId: string, turnoId: string | null, qtd: number) {
    const t =
      turnoId ??
      exigir(await criarTurno(u.cliente, { obra_id: obraId, data: "2026-11-09", periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00" })).id;
    if (turnoId) exigir(await aplicarAcao(u.cliente, t, "reabrir", { motivo: `Lançamento atrasado ${qtd}` }));
    else exigir(await aplicarAcao(u.cliente, t, "liberar"));
    const at = await atividadeDoTurno(t);
    const { data: atual } = await u.cliente.from("atividades").select("qtd_realizada, causa, observacao").eq("id", at).single();
    const esperado = atual ? { ...atual, qtd_realizada: atual.qtd_realizada === null ? null : Number(atual.qtd_realizada) } : VAZIO;
    exigir(await salvarExecucaoPlanejador(u.cliente, t, at, { qtd_realizada: qtd, causa: qtd < 120 ? "material" : null, observacao: null }, esperado));
    exigir(await aplicarAcao(u.cliente, t, "fechar"));
    return t;
  }

  async function cenario(realizado: number) {
    const obra = exigir(await criarObra(u.cliente, { nome: "Obra Trazer" }));
    const anterior = exigir(await criarRascunho(u.cliente, obra.id, "2026-11-09"));
    const origem = exigir(await salvarAtividadeProgramada(u.cliente, anterior.id, base)).id;
    exigir(await programarSemana(u.cliente, anterior.id));
    const turnoId = await lancar(obra.id, null, realizado);
    const atual = exigir(await criarRascunho(u.cliente, obra.id, "2026-11-16"));
    return { obraId: obra.id, anterior, origem, atual, turnoId };
  }

  it("resumo da semana anterior: pendente com saldo; sem anterior ou em rascunho, null", { timeout: 90_000 }, async () => {
    const { obraId, atual } = await cenario(100);
    const r = await resumoSemanaAnterior(u.cliente, atual);
    expect(r && pendentesDaSemanaAnterior(r)).toMatchObject([{ saldo: 20, metaTotal: 120, realizado: 100 }]);
    const depois = exigir(await criarRascunho(u.cliente, obraId, "2026-11-30"));
    expect(await resumoSemanaAnterior(u.cliente, depois)).toBeNull();
    const seguinte = exigir(await criarRascunho(u.cliente, obraId, "2026-11-23"));
    expect(await resumoSemanaAnterior(u.cliente, seguinte)).toBeNull(); // 16/11 está em rascunho
  });

  it("atualizar meta segue o saldo atual da origem", { timeout: 120_000 }, async () => {
    const { obraId, origem, atual, turnoId } = await cenario(100);
    const id = exigir(await salvarAtividadeProgramada(u.cliente, atual.id, { ...base, meta: 20, trazida_de: origem, saldo_trazido: 20 })).id;
    await lancar(obraId, turnoId, 108);
    expect(await atualizarMetaTrazida(u.cliente, id)).toEqual({ ok: true, dados: { meta: 12 } });
    const a = (await obterDadosSemana(u.cliente, atual)).atividades.find((x) => x.id === id);
    expect(a).toMatchObject({ meta: 12, saldo_trazido: 12 });
  });

  it("origem concluída: não atualiza", { timeout: 120_000 }, async () => {
    const { obraId, origem, atual, turnoId } = await cenario(100);
    const id = exigir(await salvarAtividadeProgramada(u.cliente, atual.id, { ...base, meta: 20, trazida_de: origem, saldo_trazido: 20 })).id;
    await lancar(obraId, turnoId, 120);
    expect(await atualizarMetaTrazida(u.cliente, id)).toEqual({ ok: false, erro: "A semana anterior já concluiu esta atividade." });
  });

  it("semana programada: atualiza sem turno; com turno, pede para reabrir", { timeout: 120_000 }, async () => {
    const { obraId, origem, atual, turnoId } = await cenario(100);
    const id = exigir(await salvarAtividadeProgramada(u.cliente, atual.id, { ...base, meta: 20, trazida_de: origem, saldo_trazido: 20 })).id;
    exigir(await programarSemana(u.cliente, atual.id));
    await lancar(obraId, turnoId, 105);
    expect(await atualizarMetaTrazida(u.cliente, id)).toEqual({ ok: true, dados: { meta: 15 } });
    exigir(await criarTurno(u.cliente, { obra_id: obraId, data: "2026-11-16", periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00" }));
    await lancar(obraId, turnoId, 110);
    expect(await atualizarMetaTrazida(u.cliente, id)).toEqual({
      ok: false,
      erro: "Esta atividade já está num turno. Reabra a semana para mudar a meta.",
    });
  });
});
