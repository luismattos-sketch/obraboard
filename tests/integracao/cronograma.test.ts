import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  apagarItemManual,
  importarCronograma,
  levadasPorItem,
  listarItensCronograma,
  salvarItemManual,
  ultimaImportacao,
} from "@/lib/db/cronograma";
import { criarObra } from "@/lib/db/obras";
import { criarRascunho, obterDadosSemana, salvarAtividadeProgramada } from "@/lib/db/programacao";
import type { ItemLido } from "@/lib/dominio/cronograma";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

const exigir = <T,>(r: { ok: true; dados: T } | { ok: false; erro: string }): T => {
  if (!r.ok) throw new Error(r.erro);
  return r.dados;
};

describe.skipIf(!ligado)("cronograma do lookahead (5.1)", () => {
  let a: UsuarioTeste;
  let b: UsuarioTeste;
  beforeAll(async () => {
    a = await criarUsuarioTeste();
    b = await criarUsuarioTeste();
  });
  afterAll(async () => {
    if (a) await removerUsuarioTeste(a.userId);
    if (b) await removerUsuarioTeste(b.userId);
  });

  it("RLS: outro usuário não vê nem grava itens do cronograma", { timeout: 60_000 }, async () => {
    const obra = exigir(await criarObra(a.cliente, { nome: "Obra Cronograma RLS" }));
    const item = { obra_id: obra.id, origem: "manual", descricao: "Montar suporte", inicio: "2026-12-01", fim: "2026-12-03" };
    const ins = await a.cliente.from("cronograma_itens").insert(item).select("id").single();
    expect(ins.error).toBeNull();
    const intruso = await b.cliente.from("cronograma_itens").insert(item);
    expect(intruso.error).not.toBeNull();
    const ver = await b.cliente.from("cronograma_itens").select("id").eq("obra_id", obra.id);
    expect(ver.data).toEqual([]);
  });

  const lido = (codigo: string, descricao = `Item ${codigo}`): ItemLido => ({
    codigo, descricao, inicio: "2026-12-01", fim: "2026-12-05", local: null, unidade: "m", quantidade: 10,
  });
  const mapa = { codigo: 0, descricao: 1, inicio: 2, fim: 3 };

  it("importa, reimporta pelo código e preserva manuais e atividades levadas", { timeout: 120_000 }, async () => {
    const obra = exigir(await criarObra(a.cliente, { nome: "Obra Cronograma" }));
    expect(exigir(await importarCronograma(a.cliente, obra.id, "v1.xlsx", mapa, [lido("A"), lido("B"), lido("C")])))
      .toEqual({ novos: 3, atualizados: 0, removidos: 0 });
    const manual = exigir(await salvarItemManual(a.cliente, obra.id, {
      descricao: "Andaime", inicio: "2026-12-01", fim: "2026-12-02", local: null, unidade: null, quantidade: null,
    }));
    const itens = await listarItensCronograma(a.cliente, obra.id);
    const b = itens.find((i) => i.codigo === "B")!;
    const semana = exigir(await criarRascunho(a.cliente, obra.id, "2026-12-01"));
    exigir(await salvarAtividadeProgramada(a.cliente, semana.id, {
      descricao: b.descricao, meta: 10, dias: [1], periodo: "diurno", equipe: [], cronograma_item_id: b.id,
    }));

    expect(exigir(await importarCronograma(a.cliente, obra.id, "v2.xlsx", mapa, [lido("A"), lido("B", "B revisado"), lido("D")])))
      .toEqual({ novos: 1, atualizados: 1, removidos: 1 });
    const depois = await listarItensCronograma(a.cliente, obra.id, { incluirRemovidos: true });
    expect(depois.find((i) => i.codigo === "C")!.removido_em).not.toBeNull();
    expect(depois.find((i) => i.id === manual.id)!.descricao).toBe("Andaime");
    expect((await listarItensCronograma(a.cliente, obra.id)).some((i) => i.codigo === "C")).toBe(false);
    const dados = await obterDadosSemana(a.cliente, semana);
    expect(dados.atividades[0]).toMatchObject({ descricao: "Item B", cronograma_item_id: b.id });
    expect((await levadasPorItem(a.cliente, obra.id)).get(b.id)?.map((l) => l.inicio)).toEqual([semana.inicio]);

    expect(exigir(await importarCronograma(a.cliente, obra.id, "v2.xlsx", mapa, [lido("A"), lido("B", "B revisado"), lido("D")])))
      .toEqual({ novos: 0, atualizados: 0, removidos: 0 });
    expect((await ultimaImportacao(a.cliente, obra.id))?.mapeamento).toEqual(mapa);
  });

  it("manual: valida e não deixa editar nem apagar importado", { timeout: 60_000 }, async () => {
    const obra = exigir(await criarObra(a.cliente, { nome: "Obra Manual" }));
    const r = await salvarItemManual(a.cliente, obra.id, { descricao: "X", inicio: "2026-12-05", fim: "2026-12-01", local: null, unidade: null, quantidade: null });
    expect(r.ok).toBe(false);
    exigir(await importarCronograma(a.cliente, obra.id, "v1.csv", mapa, [lido("A")]));
    const imp = (await listarItensCronograma(a.cliente, obra.id))[0];
    expect((await salvarItemManual(a.cliente, obra.id, { ...lido("A"), descricao: "Outro" }, imp.id)).ok).toBe(false);
    expect((await apagarItemManual(a.cliente, imp.id)).ok).toBe(false);
  });

  it("apagar item manual deixa a atividade levada sem vínculo", { timeout: 60_000 }, async () => {
    const obra = exigir(await criarObra(a.cliente, { nome: "Obra Apagar" }));
    const m = exigir(await salvarItemManual(a.cliente, obra.id, { descricao: "Pintura", inicio: "2026-12-01", fim: "2026-12-02", local: null, unidade: null, quantidade: null }));
    const semana = exigir(await criarRascunho(a.cliente, obra.id, "2026-12-01"));
    exigir(await salvarAtividadeProgramada(a.cliente, semana.id, { descricao: "Pintura", meta: 1, dias: [0], periodo: "diurno", equipe: [], cronograma_item_id: m.id }));
    exigir(await apagarItemManual(a.cliente, m.id));
    const dados = await obterDadosSemana(a.cliente, semana);
    expect(dados.atividades[0].cronograma_item_id).toBeNull();
  });
});
