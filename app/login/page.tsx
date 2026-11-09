"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getContextoAtual,
  sincronizarCadastroBaseRemoto,
} from "../../lib/cadastro-base";
import { criarRotaComObra } from "../../lib/rotas";
import { supabase } from "../../lib/supabase";
import { garantirContaAtual, limparContaAtual } from "../../lib/conta";
import { obterAuthCallbackUrl, obterPasswordRecoveryUrl } from "../../lib/app-url";
import { obterConviteAcessoEmail } from "../../lib/acessos";
import { registrarSessaoAtual } from "../../lib/sessao-unica";
import {
  anexarUtmEmUrl,
  dispararSignupComplete,
  dispararSignupStart,
  dispararSignupSubmit,
  obterParametrosUtm,
} from "../../lib/analytics";

type ModoLogin = "entrar" | "cadastrar" | "ativar" | "recuperar" | "nova-senha";

export default function LoginPage({
  modoInicial = "entrar",
}: {
  modoInicial?: ModoLogin;
} = {}) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [funcao, setFuncao] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senhaConfirmacao, setSenhaConfirmacao] = useState("");
  const [modo, setModo] = useState<ModoLogin>(modoInicial);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [cadastroDisponivel, setCadastroDisponivel] = useState(false);
  const [conviteNivel, setConviteNivel] = useState("");

  useEffect(() => {
    let ativo = true;

    async function detectarRecuperacaoSenha() {
      const parametros = new URLSearchParams(window.location.search);
      const parametrosHash = new URLSearchParams(
        window.location.hash.replace(/^#/, "")
      );
      const ehRecuperacao =
        parametros.get("reset") === "senha" ||
        parametros.get("type") === "recovery" ||
        parametrosHash.get("type") === "recovery";
      const codigo = parametros.get("code");

      if (!ehRecuperacao) {
        if (parametros.get("sessao") === "encerrada") {
          setMensagem(
            "Este acesso foi iniciado em outro dispositivo. Entre novamente para continuar aqui."
          );
        }
        return;
      }

      setModo("nova-senha");
      setMensagem("Digite uma nova senha para concluir a recuperacao.");

      if (codigo) {
        const { error } = await supabase.auth.exchangeCodeForSession(codigo);

        if (!ativo) {
          return;
        }

        if (error) {
          setMensagem("Link de recuperacao invalido ou expirado. Solicite um novo link.");
          return;
        }
      }

      const { data } = await supabase.auth.getUser();

      if (ativo && data.user?.email) {
        setEmail(data.user.email);
      }
    }

    void detectarRecuperacaoSenha();

    return () => {
      ativo = false;
    };
  }, []);

  async function irParaAplicativo() {
    await registrarSessaoAtual();
    await garantirContaAtual();
    const contexto = getContextoAtual(await sincronizarCadastroBaseRemoto());
    router.push(anexarUtmEmUrl(criarRotaComObra("/painel", contexto.obraAtivaId)));
  }

  async function prepararAtivacao(emailNormalizado: string) {
    const convite = await obterConviteAcessoEmail(emailNormalizado);

    if (!convite) {
      return false;
    }

    setNome(convite.nome);
    setFuncao(convite.funcao);
    setConviteNivel(convite.nivelAcesso);
    setModo("ativar");
    setCadastroDisponivel(false);
    setMensagem("Acesso encontrado. Cadastre uma senha para entrar.");
    return true;
  }

  async function enviarFormulario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const emailNormalizado = email.trim().toLowerCase();
    const nomeNormalizado = nome.trim();
    const funcaoNormalizada = funcao.trim();

    if (!emailNormalizado) {
      setMensagem("Informe o email.");
      return;
    }

    if (modo === "recuperar") {
      setCarregando(true);
      setMensagem("");

      try {
        const { error } = await supabase.auth.resetPasswordForEmail(
          emailNormalizado,
          { redirectTo: obterPasswordRecoveryUrl() }
        );

        if (error) {
          setMensagem(descreverErroAutenticacao(error.message, "cadastro"));
          return;
        }

        setMensagem(
          "Enviamos um link para redefinir sua senha. Verifique seu email."
        );
      } finally {
        setCarregando(false);
      }
      return;
    }

    if (modo === "entrar" && !senha) {
      setCarregando(true);
      setMensagem("");
      setCadastroDisponivel(false);

      try {
        const ativacaoPreparada = await prepararAtivacao(emailNormalizado);
        if (!ativacaoPreparada) {
          setMensagem("Informe a senha para entrar.");
        }
      } catch {
        setMensagem("Nao foi possivel verificar este email agora.");
      } finally {
        setCarregando(false);
      }
      return;
    }

    if (!senha) {
      setMensagem("Informe a senha.");
      return;
    }

    if (modo === "cadastrar" && (!nomeNormalizado || !funcaoNormalizada)) {
      setMensagem("Informe nome e funcao.");
      return;
    }

    if (senha.length < 6) {
      setMensagem("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (modo === "nova-senha" && senha !== senhaConfirmacao) {
      setMensagem("A confirmacao da senha nao confere.");
      return;
    }

    setCarregando(true);
    setMensagem("");
    setCadastroDisponivel(false);
    limparContaAtual();

    try {
      if (modo === "nova-senha") {
        const { error } = await supabase.auth.updateUser({ password: senha });

        if (error) {
          setMensagem(descreverErroAutenticacao(error.message, "cadastro"));
          return;
        }

        setMensagem("Senha atualizada com sucesso. Entrando...");
        await irParaAplicativo();
        return;
      }

      if (modo === "ativar") {
        const resposta = await fetch("/api/auth/ativar-convite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: emailNormalizado,
            password: senha,
          }),
        });
        const dados = (await resposta.json()) as { error?: string };

        if (!resposta.ok) {
          setMensagem(
            descreverErroAutenticacao(
              dados.error ?? "Nao foi possivel ativar este acesso.",
              "cadastro"
            )
          );
          return;
        }

        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: emailNormalizado,
          password: senha,
        });

        if (loginError) {
          setMensagem("A senha foi criada, mas nao foi possivel entrar automaticamente. Tente entrar novamente.");
          return;
        }

        await irParaAplicativo();
        return;
      }

      if (modo === "cadastrar") {
        const emailRedirectTo = anexarUtmEmUrlAbsoluta(obterAuthCallbackUrl());
        const { data, error } = await supabase.auth.signUp({
          email: emailNormalizado,
          password: senha,
          options: {
            emailRedirectTo,
            data: {
              name: nomeNormalizado,
              nome: nomeNormalizado,
              funcao: funcaoNormalizada,
            },
          },
        });

        if (error) {
          setMensagem(
            descreverErroAutenticacao(
              error.message,
              "cadastro",
              error.code,
              error.status
            )
          );
          return;
        }

        dispararSignupSubmit(funcaoNormalizada);

        if (!data.session) {
          setMensagem("Confirme o cadastro pelo email enviado antes de entrar.");
          return;
        }

        dispararSignupComplete(data.user?.id);
        await irParaAplicativo();
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: emailNormalizado,
        password: senha,
      });

      if (error) {
        const ativacaoPreparada = await prepararAtivacao(emailNormalizado).catch(
          () => false
        );

        if (!ativacaoPreparada) {
          setCadastroDisponivel(true);
          setMensagem(
            "Nao encontramos esse acesso. Confira a senha ou cadastre este email."
          );
        }
        return;
      }

      await irParaAplicativo();
    } finally {
      setCarregando(false);
    }
  }

  function alternarModo(proximoModo: ModoLogin) {
    setModo(proximoModo);
    setMensagem("");
    setCadastroDisponivel(false);
    setConviteNivel("");
    setSenhaConfirmacao("");

    if (proximoModo === "cadastrar") {
      dispararSignupStart();
    }
  }

  const cadastrando = modo === "cadastrar";
  const ativando = modo === "ativar";
  const recuperando = modo === "recuperar";
  const novaSenha = modo === "nova-senha";
  const exibindoDadosCadastro = cadastrando || ativando;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/frentia-logo.png"
            alt="Frentia"
            className="mx-auto h-16 w-auto object-contain"
          />
          <p className="mt-2 text-slate-500">Gestao Operacional</p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => alternarModo("entrar")}
            className={`rounded-lg px-4 py-3 text-sm font-bold ${
              !cadastrando && !ativando && !recuperando && !novaSenha
                ? "bg-white text-teal-700 shadow-sm"
                : "text-slate-500"
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => alternarModo("cadastrar")}
            className={`rounded-lg px-4 py-3 text-sm font-bold ${
              cadastrando ? "bg-white text-teal-700 shadow-sm" : "text-slate-500"
            }`}
          >
            Cadastrar
          </button>
        </div>

        <form onSubmit={enviarFormulario} className="space-y-4">
          {ativando && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-800">
              Seu e-mail esta cadastrado como {conviteNivel || "usuario"}.
              Defina uma senha para acessar esta conta.
            </div>
          )}

          {recuperando && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-800">
              Informe seu e-mail para receber o link de recuperacao de senha.
            </div>
          )}

          {novaSenha && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-800">
              Crie uma nova senha para sua conta.
            </div>
          )}

          {exibindoDadosCadastro && (
            <>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">
                  Nome
                </span>
                <input
                  type="text"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  readOnly={ativando}
                  className="w-full rounded-xl border border-slate-300 p-4"
                  placeholder="Nome completo"
                  autoComplete="name"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">
                  Funcao
                </span>
                <input
                  type="text"
                  value={funcao}
                  onChange={(event) => setFuncao(event.target.value)}
                  readOnly={ativando}
                  className="w-full rounded-xl border border-slate-300 p-4"
                  placeholder="Ex.: Planejador"
                  autoComplete="organization-title"
                />
              </label>
            </>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-300 p-4"
              placeholder="email@empresa.com"
              autoComplete="email"
            />
          </label>

          {!recuperando && (
            <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">
              {novaSenha ? "Nova senha" : "Senha"}
            </span>
            <input
              type="password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              className="w-full rounded-xl border border-slate-300 p-4"
              placeholder={
                ativando || novaSenha
                  ? "Crie uma senha para este acesso"
                  : "Sua senha"
              }
              autoComplete={
                cadastrando || ativando || novaSenha
                  ? "new-password"
                  : "current-password"
              }
            />
            </label>
          )}

          {novaSenha && (
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Confirmar nova senha
              </span>
              <input
                type="password"
                value={senhaConfirmacao}
                onChange={(event) => setSenhaConfirmacao(event.target.value)}
                className="w-full rounded-xl border border-slate-300 p-4"
                placeholder="Digite a nova senha novamente"
                autoComplete="new-password"
              />
            </label>
          )}

          {!cadastrando && !ativando && !recuperando && !novaSenha && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => alternarModo("recuperar")}
                className="text-sm font-bold text-teal-700 underline"
              >
                Esqueceu a senha?
              </button>
            </div>
          )}

          {mensagem && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
              {mensagem}
              {cadastroDisponivel && (
                <button
                  type="button"
                  onClick={() => alternarModo("cadastrar")}
                  className="ml-2 font-bold text-teal-700 underline"
                >
                  Cadastrar agora
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-xl bg-teal-600 py-4 text-lg font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {carregando
              ? "Aguarde..."
              : recuperando
              ? "Enviar link de recuperacao"
              : novaSenha
              ? "Cadastrar nova senha"
              : ativando
              ? "Cadastrar senha"
              : cadastrando
              ? "Cadastrar"
              : "Entrar"}
          </button>

          {(recuperando || novaSenha) && (
            <button
              type="button"
              onClick={() => alternarModo("entrar")}
              className="w-full text-sm font-bold text-slate-500 underline"
            >
              Voltar para login
            </button>
          )}
        </form>
      </section>
    </main>
  );
}

function anexarUtmEmUrlAbsoluta(href: string) {
  if (typeof window === "undefined") {
    return href;
  }

  const url = new URL(href);
  const utms = obterParametrosUtm();

  for (const [chave, valor] of Object.entries(utms)) {
    if (!url.searchParams.has(chave)) {
      url.searchParams.set(chave, valor);
    }
  }

  return url.toString();
}

function descreverErroAutenticacao(
  mensagem: string,
  acao: "login" | "cadastro",
  codigo?: string,
  status?: number
) {
  const texto = `${codigo ?? ""} ${mensagem}`.toLowerCase();

  if (
    status === 429 ||
    texto.includes("rate limit") ||
    texto.includes("over_email_send_rate_limit")
  ) {
    return "O limite de envio de emails foi atingido. Aguarde e tente novamente mais tarde.";
  }

  if (
    texto.includes("already") ||
    texto.includes("registered") ||
    texto.includes("user_already_exists")
  ) {
    return "Este email ja esta cadastrado. Entre com a senha existente.";
  }

  if (
    texto.includes("error sending confirmation email") ||
    texto.includes("unexpected_failure")
  ) {
    return "O Supabase nao conseguiu enviar o email de confirmacao. Tente novamente mais tarde.";
  }

  if (texto.includes("signup_disabled")) {
    return "O cadastro de novos usuarios esta desativado no Supabase.";
  }

  if (
    texto.includes("email_address_invalid") ||
    texto.includes("invalid email")
  ) {
    return "Informe um endereco de email valido.";
  }

  if (texto.includes("password")) {
    return "Verifique a senha informada.";
  }

  return acao === "cadastro"
    ? "Nao foi possivel cadastrar este email agora."
    : "Nao foi possivel entrar com este email agora.";
}
