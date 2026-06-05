"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getContextoAtual, sincronizarCadastroBaseRemoto } from "../../lib/cadastro-base";
import { criarRotaComObra } from "../../lib/rotas";
import { supabase } from "../../lib/supabase";

type ModoLogin = "entrar" | "cadastrar";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modo, setModo] = useState<ModoLogin>("entrar");
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [cadastroDisponivel, setCadastroDisponivel] = useState(false);

  async function irParaAplicativo() {
    const contexto = getContextoAtual(await sincronizarCadastroBaseRemoto());
    router.push(criarRotaComObra("/", contexto.obraAtivaId));
  }

  async function enviarFormulario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const emailNormalizado = email.trim().toLowerCase();

    if (!emailNormalizado || !senha) {
      setMensagem("Informe email e senha.");
      return;
    }

    if (senha.length < 6) {
      setMensagem("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    setCarregando(true);
    setMensagem("");
    setCadastroDisponivel(false);

    try {
      if (modo === "cadastrar") {
        const { error } = await supabase.auth.signUp({
          email: emailNormalizado,
          password: senha,
        });

        if (error) {
          setMensagem(descreverErroAutenticacao(error.message, "cadastro"));
          return;
        }

        await irParaAplicativo();
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: emailNormalizado,
        password: senha,
      });

      if (error) {
        setCadastroDisponivel(true);
        setMensagem(
          "Não encontramos esse acesso. Confira a senha ou cadastre este email."
        );
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
  }

  const cadastrando = modo === "cadastrar";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-slate-900">ObraBoard</h1>
          <p className="mt-2 text-slate-500">Gestão operacional de obra</p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => alternarModo("entrar")}
            className={`rounded-lg px-4 py-3 text-sm font-bold ${
              !cadastrando ? "bg-white text-teal-700 shadow-sm" : "text-slate-500"
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

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">
              Senha
            </span>
            <input
              type="password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              className="w-full rounded-xl border border-slate-300 p-4"
              placeholder="Sua senha"
              autoComplete={cadastrando ? "new-password" : "current-password"}
            />
          </label>

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
              : cadastrando
              ? "Cadastrar e entrar"
              : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}

function descreverErroAutenticacao(mensagem: string, acao: "login" | "cadastro") {
  const texto = mensagem.toLowerCase();

  if (texto.includes("already") || texto.includes("registered")) {
    return "Este email já está cadastrado. Entre com a senha existente.";
  }

  if (texto.includes("password")) {
    return "Verifique a senha informada.";
  }

  return acao === "cadastro"
    ? "Não foi possível cadastrar este email agora."
    : "Não foi possível entrar com este email agora.";
}
