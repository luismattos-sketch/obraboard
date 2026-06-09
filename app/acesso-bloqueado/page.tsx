"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const mensagens: Record<string, string> = {
  suspended:
    "Sua conta está temporariamente suspensa. Entre em contato com o suporte.",
  cancelled: "O acesso desta conta foi cancelado.",
  banned: "Este e-mail não está autorizado a acessar o aplicativo.",
  deleted_pending: "A remoção desta conta está em processamento.",
  deleted: "Conta não encontrada ou removida.",
};

export default function AcessoBloqueadoPage() {
  const [mensagem, setMensagem] = useState(mensagens.deleted);

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("status") ?? "deleted";
    queueMicrotask(() => {
      setMensagem(mensagens[status] ?? mensagens.deleted);
    });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/frentia-logo.png"
          alt="Frentia"
          className="mx-auto h-16 w-auto object-contain"
        />
        <h1 className="mt-6 text-xl font-bold text-slate-900">
          Acesso indisponível
        </h1>
        <p className="mt-3 text-slate-600">{mensagem}</p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-xl bg-teal-600 px-5 py-3 font-bold text-white"
        >
          Voltar ao login
        </Link>
      </section>
    </main>
  );
}
