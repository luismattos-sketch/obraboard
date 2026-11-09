"use server";

import { redirect } from "next/navigation";
import { criarEmpresaDoDono, deveRemoverUsuario } from "@/lib/db/empresas";
import { falha, ok, type Resultado } from "@/lib/db/resultado";
import { caminhoSeguro } from "@/lib/dominio/caminho";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export type Retorno = Resultado<{ mensagem: string } | undefined>;
type Estado = Retorno | null;

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const urlApp = () => (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

export async function cadastrar(_: Estado, form: FormData): Promise<Retorno> {
  const nome = texto(form, "nome");
  const empresa = texto(form, "empresa");
  const email = texto(form, "email");
  const senha = String(form.get("senha") ?? "");

  const campos: Record<string, string> = {};
  if (!nome) campos.nome = "Informe seu nome.";
  if (!empresa) campos.empresa = "Informe o nome da empresa.";
  if (!emailValido(email)) campos.email = "Informe um e-mail válido.";
  if (senha.length < 8) campos.senha = "A senha deve ter ao menos 8 caracteres.";
  if (Object.keys(campos).length) return falha("Revise os campos.", campos);

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: { emailRedirectTo: `${urlApp()}/auth/confirmar`, data: { nome } },
  });
  if (error || !data.user) return falha("Não foi possível concluir o cadastro. Tente novamente.");

  const mensagem = `Enviamos um link de confirmação para ${email}`;
  // E-mail já cadastrado: o Supabase devolve usuário sem identidades. Não revelar nem duplicar.
  if (!data.user.identities || data.user.identities.length === 0) return ok({ mensagem });

  const r = await criarEmpresaDoDono(data.user.id, empresa);
  if (!r.ok) {
    // Falha na consulta de vínculo: o usuário pode já ter empresa, não remover.
    if (deveRemoverUsuario(r)) {
      const { error: eDel } = await criarClienteAdmin().auth.admin.deleteUser(data.user.id);
      if (eDel) console.error("cadastrar: falha ao remover usuário órfão", data.user.id, eDel.message);
    }
    return falha("Não foi possível concluir o cadastro. Tente novamente.");
  }
  return ok({ mensagem });
}

export async function entrar(_: Estado, form: FormData): Promise<Retorno> {
  const email = texto(form, "email");
  const senha = String(form.get("senha") ?? "");
  const proximo = caminhoSeguro(texto(form, "proximo"));

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) return falha("E-mail ou senha incorretos");
  redirect(proximo);
}

export async function recuperarSenha(_: Estado, form: FormData): Promise<Retorno> {
  const email = texto(form, "email");
  if (emailValido(email)) {
    const supabase = await criarClienteServidor();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${urlApp()}/auth/confirmar?proximo=/redefinir-senha`,
    });
  }
  return ok({ mensagem: "Se o e-mail existir, enviamos um link" });
}

export async function redefinirSenha(_: Estado, form: FormData): Promise<Retorno> {
  const senha = String(form.get("senha") ?? "");
  if (senha.length < 8) {
    return falha("Revise os campos.", { senha: "A senha deve ter ao menos 8 caracteres." });
  }
  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) return falha("Não foi possível redefinir a senha. Solicite um novo link.");
  redirect("/obras");
}

export async function sair(): Promise<void> {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/");
}
