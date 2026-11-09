import { afterAll, describe, expect, it } from "vitest";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarEmpresaDoDono } from "@/lib/db/empresas";
import { criarClienteAnon, ligado, removerUsuarioTeste } from "./ajuda";

describe.skipIf(!ligado)("cadastro: criarEmpresaDoDono", () => {
  let userId: string | null = null;

  afterAll(async () => {
    if (userId) await removerUsuarioTeste(userId);
  });

  it("cria empresa e vínculo de dono visível ao usuário", async () => {
    const admin = criarClienteAdmin();
    const email = `teste+${crypto.randomUUID().slice(0, 12)}@frentia.test`;
    const senha = `Senha-${crypto.randomUUID()}`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(error?.message);
    userId = data.user.id;

    const r = await criarEmpresaDoDono(userId, "Construtora Teste");
    expect(r.ok).toBe(true);

    const cliente = criarClienteAnon();
    const { error: el } = await cliente.auth.signInWithPassword({ email, password: senha });
    expect(el).toBeNull();
    const { data: ms } = await cliente.from("membros").select("papel, empresa_id");
    expect(ms).toHaveLength(1);
    expect(ms![0].papel).toBe("dono");
    if (r.ok) expect(ms![0].empresa_id).toBe(r.dados.empresaId);
  });
});
