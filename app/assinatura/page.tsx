"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  planosAssinatura,
  planosComerciais,
  type PlanoCodigo,
} from "../../lib/planos";
import { supabase } from "../../lib/supabase";

const mensagens: Record<string, string> = {
  suspended:
    "Sua assinatura precisa ser regularizada para continuar usando o Frentia.",
  cancelled:
    "Sua assinatura foi cancelada. Assine novamente para liberar o acesso.",
};

export default function AssinaturaPage() {
  const [mensagem, setMensagem] = useState(
    "Escolha o plano ideal para continuar usando o Frentia."
  );
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState<PlanoCodigo | null>(null);

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("status");
    if (status && mensagens[status]) {
      queueMicrotask(() => setMensagem(mensagens[status]));
    }
  }, []);

  async function assinarPlano(plano: PlanoCodigo) {
    setErro("");
    setCarregando(plano);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        setErro("Entre na sua conta antes de assinar.");
        return;
      }

      const resposta = await fetch("/api/billing/mercadopago/subscribe", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan: plano }),
      });
      const payload = (await resposta.json()) as {
        initPoint?: string;
        error?: string;
      };

      if (!resposta.ok || !payload.initPoint) {
        setErro(payload.error ?? "Nao foi possivel iniciar a assinatura.");
        return;
      }

      window.location.href = payload.initPoint;
    } finally {
      setCarregando(null);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-5xl rounded-2xl bg-white p-8 shadow-xl">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/frentia-logo.png"
            alt="Frentia"
            className="mx-auto h-16 w-auto object-contain"
          />
          <p className="mt-4 text-sm font-bold uppercase text-teal-600">
            Assinatura
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Planos Frentia
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">{mensagem}</p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {planosAssinatura.map((codigo) => {
            const plano = planosComerciais[codigo];
            const destacado = codigo === "premium";
            const frentes =
              plano.limites.frentesAtivas === null
                ? "Frentes ativas ilimitadas"
                : `${plano.limites.frentesAtivas} ${
                    plano.limites.frentesAtivas === 1
                      ? "frente ativa"
                      : "frentes ativas"
                  }`;
            const planejadores =
              plano.limites.planejadores === null
                ? "Planejadores ilimitados"
                : `${plano.limites.planejadores} ${
                    plano.limites.planejadores === 1
                      ? "planejador"
                      : "planejadores"
                  }`;
            const visitantes =
              plano.limites.visitantes === null
                ? "Visitantes ilimitados"
                : `${plano.limites.visitantes} ${
                    plano.limites.visitantes === 1 ? "visitante" : "visitantes"
                  }`;

            return (
              <article
                key={codigo}
                className={`flex flex-col rounded-2xl border p-5 ${
                  destacado ? "border-2 border-orange-500" : "border-slate-200"
                }`}
              >
                {destacado && (
                  <span className="mb-3 inline-flex w-fit rounded-full bg-orange-500 px-3 py-1 text-xs font-bold text-white">
                    Mais indicado
                  </span>
                )}
                <h2 className="text-xl font-bold text-slate-900">{plano.nome}</h2>
                <p className="mt-2 text-4xl font-black text-blue-950">
                  R$ {plano.preco}{" "}
                  <span className="text-sm font-bold text-slate-500">/mes</span>
                </p>
                <ul className="mt-5 space-y-2 text-sm font-semibold text-slate-700">
                  <li>- {frentes}</li>
                  <li>- {planejadores}</li>
                  <li>- {visitantes}</li>
                  <li>- QR Code ilimitado</li>
                  <li>- Turnos, atividades, indicadores e RDO ilimitados</li>
                </ul>
                <button
                  type="button"
                  onClick={() => assinarPlano(codigo)}
                  disabled={carregando !== null}
                  className={`mt-auto rounded-xl px-4 py-3 font-bold text-white shadow-lg transition-colors disabled:cursor-not-allowed disabled:bg-slate-300 ${
                    destacado
                      ? "bg-orange-500 hover:bg-orange-600"
                      : "bg-blue-950 hover:bg-blue-900"
                  }`}
                >
                  {carregando === codigo
                    ? "Abrindo Mercado Pago..."
                    : `Assinar ${plano.nome}`}
                </button>
              </article>
            );
          })}
        </div>

        {erro && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {erro}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
          <Link href="/painel" className="font-bold text-teal-700">
            Voltar ao painel
          </Link>
          <span className="text-slate-300">-</span>
          <Link href="/login" className="font-bold text-slate-500">
            Entrar com outra conta
          </Link>
        </div>
      </section>
    </main>
  );
}
