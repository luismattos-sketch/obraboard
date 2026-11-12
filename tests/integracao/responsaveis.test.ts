import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ERRO_RESPONSAVEL_DUPLICADO } from "@/lib/db/mensagens";
import { criarObra } from "@/lib/db/obras";
import { criarResponsavel, definirAtivo, editarResponsavel, listarResponsaveis } from "@/lib/db/responsaveis";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

describe.skipIf(!ligado)("responsáveis", () => {
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

  it("cria, valida, edita e desativa", async () => {
    const o = exigir(await criarObra(u.cliente, { nome: "Obra Responsáveis" }));
    const j = exigir(await criarResponsavel(u.cliente, o.id, { nome: "  João ", telefone: " " }));
    expect(j).toMatchObject({ nome: "João", telefone: null, ativo: true, obra_id: o.id });

    expect((await criarResponsavel(u.cliente, o.id, { nome: "   " })).ok).toBe(false);
    expect((await criarResponsavel(u.cliente, o.id, { nome: "x".repeat(61) })).ok).toBe(false);
    const dup = await criarResponsavel(u.cliente, o.id, { nome: "joão" });
    expect(dup).toEqual({ ok: false, erro: ERRO_RESPONSAVEL_DUPLICADO });

    exigir(await criarResponsavel(u.cliente, o.id, { nome: "Ana", telefone: "11 99999-0000" }));
    const ed = exigir(await editarResponsavel(u.cliente, j.id, { nome: "João Silva", telefone: "11 98888-0000" }));
    expect(ed).toMatchObject({ nome: "João Silva", telefone: "11 98888-0000" });

    exigir(await definirAtivo(u.cliente, j.id, false));
    const lista = await listarResponsaveis(u.cliente, o.id);
    expect(lista.map((r) => [r.nome, r.ativo])).toEqual([["Ana", true], ["João Silva", false]]);
  }, 30_000);
});
