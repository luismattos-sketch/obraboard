import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarObra } from "@/lib/db/obras";
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
});
