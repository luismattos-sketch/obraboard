import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { editarNomeEmpresa, obterNomeEmpresa } from "@/lib/db/empresas";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

describe.skipIf(!ligado)("nome da empresa", () => {
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

  it("o dono edita e lê o próprio nome; a outra empresa não muda", async () => {
    const nomeB = await obterNomeEmpresa(b.cliente);
    const r = await editarNomeEmpresa(a.cliente, "  Nova A  ");
    expect(r).toEqual({ ok: true, dados: { nome: "Nova A" } });
    expect(await obterNomeEmpresa(a.cliente)).toBe("Nova A");
    expect(await obterNomeEmpresa(b.cliente)).toBe(nomeB);
  });

  it("vazio não salva", async () => {
    const r = await editarNomeEmpresa(a.cliente, "   ");
    expect(r.ok).toBe(false);
    expect(await obterNomeEmpresa(a.cliente)).toBe("Nova A");
  });

  it("update direto pelo cliente do usuário segue bloqueado", async () => {
    await b.cliente.from("empresas").update({ nome: "Invasora" }).eq("id", a.empresaId);
    const { data } = await criarClienteAdmin().from("empresas").select("nome").eq("id", a.empresaId).single();
    expect(data!.nome).toBe("Nova A");
  });
});
