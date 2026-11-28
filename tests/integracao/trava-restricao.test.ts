import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { salvarItemManual } from "@/lib/db/cronograma";
import { criarObra } from "@/lib/db/obras";
import {
  criarRascunho, dadosOficiais, encerrarSemana, ERRO_MOTIVO_RESTRICAO, obterDadosSemana, obterSemana,
  programarSemanaComMotivo, salvarAtividadeProgramada,
} from "@/lib/db/programacao";
import { salvarRestricao } from "@/lib/db/restricoes";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

const exigir = <T,>(r: { ok: true; dados: T } | { ok: false; erro: string }): T => {
  if (!r.ok) throw new Error(r.erro);
  return r.dados;
};

describe.skipIf(!ligado)("trava com motivo (5.3)", () => {
  let u: UsuarioTeste;
  beforeAll(async () => { u = await criarUsuarioTeste(); });
  afterAll(async () => { if (u) await removerUsuarioTeste(u.userId); });

  it("exige motivo ao levar e ao programar; motivo vai para a foto", { timeout: 180_000 }, async () => {
    const c = u.cliente;
    const obra = exigir(await criarObra(c, { nome: "Obra Trava" }));
    const item = exigir(await salvarItemManual(c, obra.id, { descricao: "Tubulação", inicio: "2026-11-02", fim: "2026-11-06", local: null, unidade: null, quantidade: null }));
    const livre = exigir(await salvarItemManual(c, obra.id, { descricao: "Pintura", inicio: "2026-11-02", fim: "2026-11-06", local: null, unidade: null, quantidade: null }));
    exigir(await salvarRestricao(c, item.id, { tipo: "liberacao_area", descricao: "PT", responsavel: "Marcos" }));
    const semana = exigir(await criarRascunho(c, obra.id, "2026-11-02"));
    const ativ = { meta: 1, dias: [0 as const], periodo: "diurno" as const, equipe: [] };

    const sem = await salvarAtividadeProgramada(c, semana.id, { ...ativ, descricao: "Tubulação", cronograma_item_id: item.id });
    expect(sem).toMatchObject({ ok: false, erro: ERRO_MOTIVO_RESTRICAO });
    const a = exigir(await salvarAtividadeProgramada(c, semana.id, { ...ativ, descricao: "Tubulação", cronograma_item_id: item.id, justificativa_restricao: "Cliente libera segunda" }));
    const b = exigir(await salvarAtividadeProgramada(c, semana.id, { ...ativ, descricao: "Pintura", cronograma_item_id: livre.id }));
    // edição não apaga o motivo
    exigir(await salvarAtividadeProgramada(c, semana.id, { ...ativ, descricao: "Tubulação L3" }, a.id));

    // restrição surge depois de levar → programar pede motivo
    exigir(await salvarRestricao(c, livre.id, { tipo: "material", descricao: "Tinta", responsavel: "Almox" }));
    const r1 = await programarSemanaComMotivo(c, semana, null);
    expect(r1.ok).toBe(false);
    expect("pendentes" in r1 ? r1.pendentes.map((p) => p.id) : []).toEqual([b.id]);
    exigir(await programarSemanaComMotivo(c, semana, "Tinta chega terça"));

    const dados = await obterDadosSemana(c, semana);
    expect(Object.fromEntries(dados.atividades.map((x) => [x.id, x.justificativa_restricao])))
      .toEqual({ [a.id]: "Cliente libera segunda", [b.id]: "Tinta chega terça" });

    const programada = (await obterSemana(c, obra.id, semana.inicio))!;
    exigir(await encerrarSemana(c, programada, { [a.id]: "outro", [b.id]: "outro" }));
    const encerrada = (await obterSemana(c, obra.id, semana.inicio))!;
    const foto = await dadosOficiais(c, encerrada);
    expect(foto.atividades.find((x) => x.id === a.id)?.justificativa_restricao).toBe("Cliente libera segunda");
  });
});
