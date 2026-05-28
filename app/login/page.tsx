"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { carregarCadastroBase, obterObraAtivaId } from "../../lib/cadastro-base";
import { criarCampoPath, criarRotaComObra } from "../../lib/rotas";

export default function LoginPage() {

  const router = useRouter();

  const [perfil, setPerfil] =
    useState("Planejador");

  function entrar() {
    const obraAtivaId = obterObraAtivaId(carregarCadastroBase());

    if (perfil === "Planejador") {
      router.push(criarRotaComObra("/checkin", obraAtivaId));
    }

    else if (perfil === "Supervisor") {
      router.push(criarCampoPath(obraAtivaId));
    }

    else if (perfil === "Gestor") {
      router.push(criarRotaComObra("/", obraAtivaId));
    }

    else {
      router.push(criarRotaComObra("/", obraAtivaId));
    }

  }

  return (

    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">

      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">

        <div className="mb-8 text-center">

          <h1 className="text-4xl font-bold text-slate-900">
            ObraBoard
          </h1>

          <p className="mt-2 text-slate-500">
            Gestão operacional de obra
          </p>

        </div>

        <div className="space-y-4">

          <input
            className="w-full rounded-xl border border-slate-300 p-4"
            placeholder="Usuário"
          />

          <input
            type="password"
            className="w-full rounded-xl border border-slate-300 p-4"
            placeholder="Senha"
          />

          <select
            value={perfil}
            onChange={(e) =>
              setPerfil(e.target.value)
            }
            className="w-full rounded-xl border border-slate-300 p-4"
          >

            <option>
              Planejador
            </option>

            <option>
              Supervisor
            </option>

            <option>
              Fiscal
            </option>

            <option>
              Gestor
            </option>

          </select>

        </div>

        <button
          onClick={entrar}
          className="mt-6 w-full rounded-xl bg-teal-600 py-4 text-lg font-bold text-white"
        >
          Entrar
        </button>

      </div>

    </main>

  );
}
