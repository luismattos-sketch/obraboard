import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarObra, editarCidadeObra, listarObras, obterObra } from "@/lib/db/obras";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

describe.skipIf(!ligado)("obras", () => {
  let u: UsuarioTeste;
  beforeAll(async () => {
    u = await criarUsuarioTeste();
  });
  afterAll(async () => {
    if (u) await removerUsuarioTeste(u.userId);
  });

  it("exige o nome da obra", async () => {
    expect(await criarObra(u.cliente, { nome: "  " })).toEqual({ ok: false, erro: "Informe o nome da obra" });
  });

  it("cria e lista obra, normalizando campos vazios", async () => {
    const r = await criarObra(u.cliente, { nome: " Edifício Aurora ", cliente: "  ", endereco: "" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dados.nome).toBe("Edifício Aurora");
    expect(r.dados.cliente).toBeNull();
    expect(r.dados.endereco).toBeNull();
    expect(r.dados.empresa_id).toBe(u.empresaId);
    const lista = await listarObras(u.cliente);
    expect(lista).toHaveLength(1);
    expect(lista[0].nome).toBe("Edifício Aurora");
    expect((await obterObra(u.cliente, r.dados.id))?.id).toBe(r.dados.id);
  });

  it("obterObra de id inexistente devolve null", async () => {
    expect(await obterObra(u.cliente, crypto.randomUUID())).toBeNull();
  });
  it("cidade da obra: grava na criação e na edição", { timeout: 30_000 }, async () => {
    const macae = { nome: "Macaé, Rio de Janeiro", latitude: -22.37, longitude: -41.79 };
    const r = await criarObra(u.cliente, { nome: "Obra Cidade", cidade: macae });
    if (!r.ok) throw new Error(r.erro);
    expect(r.dados).toMatchObject({ local_nome: macae.nome, latitude: macae.latitude, longitude: macae.longitude });
    const sp = { nome: "São Paulo, São Paulo", latitude: -23.55, longitude: -46.64 };
    expect((await editarCidadeObra(u.cliente, r.dados.id, sp)).ok).toBe(true);
    expect(await obterObra(u.cliente, r.dados.id)).toMatchObject({ local_nome: sp.nome, latitude: sp.latitude });
    expect(await editarCidadeObra(u.cliente, crypto.randomUUID(), sp)).toEqual({ ok: false, erro: "Obra não encontrada" });
  });
});
