"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import { Campo } from "@/components/ui/Campo";
import { cadastrar, entrar, recuperarSenha, redefinirSenha, type Retorno } from "./auth-acoes";

type Acao = (estado: Retorno | null, form: FormData) => Promise<Retorno>;

function Mensagem({ estado }: { estado: Retorno | null }) {
  if (!estado) return null;
  if (estado.ok) {
    return estado.dados ? <Aviso tom="sucesso">{estado.dados.mensagem}</Aviso> : null;
  }
  return estado.campos ? null : <Aviso tom="perigo">{estado.erro}</Aviso>;
}

const erroCampo = (e: Retorno | null, k: string) => (e && !e.ok ? e.campos?.[k] : undefined);

function useForm(acao: Acao) {
  return useActionState<Retorno | null, FormData>(acao, null);
}

export function FormLogin({
  proximo,
  aviso,
  sucesso,
}: {
  proximo?: string;
  aviso?: string;
  sucesso?: string;
}) {
  const [estado, action, pendente] = useForm(entrar);
  return (
    <form action={action} className="flex flex-col gap-4">
      {sucesso && <Aviso tom="sucesso">{sucesso}</Aviso>}
      {aviso && <Aviso tom="alerta">{aviso}</Aviso>}
      <Mensagem estado={estado} />
      <input type="hidden" name="proximo" value={proximo ?? ""} />
      <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" required />
      <Campo rotulo="Senha" name="senha" type="password" autoComplete="current-password" required />
      <Botao type="submit" carregando={pendente}>Entrar</Botao>
      <div className="flex flex-col gap-1 text-center text-sm">
        <Link href="/recuperar-senha" className="text-primaria underline">Esqueci minha senha</Link>
        <Link href="/cadastro" className="text-primaria underline">Criar conta grátis</Link>
      </div>
    </form>
  );
}

export function FormCadastro() {
  const [estado, action, pendente] = useForm(cadastrar);
  if (estado?.ok && estado.dados) {
    return <Aviso tom="sucesso">{estado.dados.mensagem}</Aviso>;
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <Mensagem estado={estado} />
      <Campo rotulo="Seu nome" name="nome" autoComplete="name" required maxLength={120} erro={erroCampo(estado, "nome")} />
      <Campo rotulo="Nome da empresa" name="empresa" autoComplete="organization" required maxLength={120} erro={erroCampo(estado, "empresa")} />
      <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" required erro={erroCampo(estado, "email")} />
      <Campo rotulo="Senha (mínimo 8 caracteres)" name="senha" type="password" minLength={8} autoComplete="new-password" required erro={erroCampo(estado, "senha")} />
      <Botao type="submit" carregando={pendente}>Criar conta grátis</Botao>
      <p className="text-center text-xs text-texto-suave">
        Ao criar a conta você concorda com os{" "}
        <Link href="/termos" className="underline">Termos de uso</Link> e a{" "}
        <Link href="/privacidade" className="underline">Política de privacidade</Link>.
      </p>
      <p className="text-center text-sm">
        Já tem conta? <Link href="/login" className="text-primaria underline">Entrar</Link>
      </p>
    </form>
  );
}

export function FormRecuperar() {
  const [estado, action, pendente] = useForm(recuperarSenha);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Mensagem estado={estado} />
      <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" required />
      <Botao type="submit" carregando={pendente}>Enviar link de recuperação</Botao>
      <Link href="/login" className="text-center text-sm text-primaria underline">Voltar para o login</Link>
    </form>
  );
}

export function FormRedefinir() {
  const [estado, action, pendente] = useForm(redefinirSenha);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Mensagem estado={estado} />
      <Campo rotulo="Nova senha (mínimo 8 caracteres)" name="senha" type="password" minLength={8} autoComplete="new-password" required erro={erroCampo(estado, "senha")} />
      <Botao type="submit" carregando={pendente}>Salvar nova senha</Botao>
    </form>
  );
}
