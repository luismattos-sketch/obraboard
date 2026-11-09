import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { criarClienteAdmin } from "@/lib/supabase/admin";

export const ligado = process.env.SUPABASE_TEST === "1";

export type UsuarioTeste = {
  userId: string;
  email: string;
  senha: string;
  empresaId: string;
  cliente: SupabaseClient;
};

export function criarClienteAnon(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function criarUsuarioTeste(): Promise<UsuarioTeste> {
  const admin = criarClienteAdmin();
  const sufixo = crypto.randomUUID().slice(0, 12);
  const email = `teste+${sufixo}@frentia.test`;
  const senha = `Senha-${crypto.randomUUID()}`;

  const { data: u, error: eu } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (eu || !u.user) throw new Error(`createUser: ${eu?.message}`);
  const userId = u.user.id;

  try {
    const { data: emp, error: ee } = await admin
      .from("empresas")
      .insert({ nome: `Empresa teste ${sufixo}` })
      .select("id")
      .single();
    if (ee || !emp) throw new Error(`empresa: ${ee?.message}`);

    const { error: em } = await admin
      .from("membros")
      .insert({ empresa_id: emp.id, user_id: userId, papel: "dono" });
    if (em) throw new Error(`membro: ${em.message}`);

    const cliente = criarClienteAnon();
    const { error: el } = await cliente.auth.signInWithPassword({ email, password: senha });
    if (el) throw new Error(`login: ${el.message}`);

    return { userId, email, senha, empresaId: emp.id, cliente };
  } catch (e) {
    await removerUsuarioTeste(userId);
    throw e;
  }
}

export async function removerUsuarioTeste(userId: string): Promise<void> {
  const admin = criarClienteAdmin();
  const { data: ms, error: e1 } = await admin
    .from("membros")
    .select("empresa_id")
    .eq("user_id", userId);
  if (e1) throw new Error(`remover membros: ${e1.message}`);
  for (const m of ms ?? []) {
    const { error } = await admin.from("empresas").delete().eq("id", m.empresa_id); // cascata
    if (error) throw new Error(`remover empresa: ${error.message}`);
  }
  const { error: e2 } = await admin.auth.admin.deleteUser(userId);
  if (e2) throw new Error(`remover usuário: ${e2.message}`);
}
