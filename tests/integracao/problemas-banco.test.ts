import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarObra } from "@/lib/db/obras";
import { apagarProblema, criarProblema, definirResolvido, editarProblema, listarProblemas } from "@/lib/db/problemas";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

describe.skipIf(!ligado)("problemas e oportunidades no banco", () => {
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

  it("cria, edita, resolve, lista abertos e apaga; outra empresa não vê nem mexe", async () => {
    const o = await criarObra(u.cliente, { nome: "Obra Problemas" });
    if (!o.ok) throw new Error(o.erro);
    const c = await criarProblema(u.cliente, o.dados.id, { tipo: "problema", descricao: "Sem andaime", responsavel: "Ana", prazo: "2026-11-30" });
    if (!c.ok) throw new Error(c.erro);
    expect(c.dados).toMatchObject({ tipo: "problema", descricao: "Sem andaime", acao: null, responsavel: "Ana", prazo: "2026-11-30", resolvido_em: null });

    expect((await editarProblema(u.cliente, c.dados.id, { tipo: "problema", descricao: "Sem andaime", acao: "Pedir ao fiscal" })).ok).toBe(true);
    expect(await listarProblemas(outro.cliente, o.dados.id)).toEqual([]);
    expect((await definirResolvido(outro.cliente, c.dados.id, true)).ok).toBe(false);
    expect((await criarProblema(outro.cliente, o.dados.id, { tipo: "problema", descricao: "x" })).ok).toBe(false);

    expect((await definirResolvido(u.cliente, c.dados.id, true)).ok).toBe(true);
    expect(await listarProblemas(u.cliente, o.dados.id, true)).toEqual([]);
    const todos = await listarProblemas(u.cliente, o.dados.id);
    expect(todos[0]).toMatchObject({ acao: "Pedir ao fiscal", prazo: null });
    expect(todos[0].resolvido_em).not.toBeNull();

    expect((await apagarProblema(outro.cliente, c.dados.id)).ok).toBe(false);
    expect((await apagarProblema(u.cliente, c.dados.id)).ok).toBe(true);
    expect(await listarProblemas(u.cliente, o.dados.id)).toEqual([]);
  });
});
