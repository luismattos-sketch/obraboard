"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { garantirContaAtual } from "../../../lib/conta";
import { supabase } from "../../../lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [mensagem, setMensagem] = useState("Confirmando seu e-mail...");

  useEffect(() => {
    let ativo = true;

    async function concluirConfirmacao() {
      const parametrosHash = new URLSearchParams(
        window.location.hash.replace(/^#/, "")
      );
      const erro =
        new URLSearchParams(window.location.search).get("error_description") ||
        parametrosHash.get("error_description");

      if (erro) {
        if (ativo) {
          setMensagem("Não foi possível confirmar o e-mail. Solicite um novo link.");
        }
        return;
      }

      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        if (ativo) {
          setMensagem("Link inválido ou expirado. Solicite um novo link.");
        }
        return;
      }

      try {
        await garantirContaAtual();

        if (ativo) {
          router.replace("/");
        }
      } catch {
        if (ativo) {
          setMensagem("E-mail confirmado, mas não foi possível carregar sua conta.");
        }
      }
    }

    void concluirConfirmacao();

    return () => {
      ativo = false;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/frentia-logo.png"
          alt="Frentia"
          className="mx-auto h-16 w-auto object-contain"
        />
        <p className="mt-6 font-semibold text-slate-700">{mensagem}</p>
      </section>
    </main>
  );
}
