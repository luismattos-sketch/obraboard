"use client";

import Link from "next/link";
import MedicaoShell from "./_components/MedicaoShell";

export default function MedicaoPage() {
  return (
    <MedicaoShell>
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Módulo em preparação
          </p>

          <h3 className="mt-2 text-2xl font-bold text-slate-900">
            Escolha uma área da medição
          </h3>

          <p className="mt-2 max-w-3xl text-slate-600">
            Primeiro vamos estruturar o cadastro do contrato e depois a tela
            de medição propriamente dita. Por enquanto, o acesso continua
            restrito ao suporte Frentia.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/medicao/contrato"
              className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600"
            >
              Abrir Contrato
            </Link>

            <Link
              href="/medicao/medir"
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-800 transition hover:border-orange-300 hover:bg-orange-50"
            >
              Abrir Medir
            </Link>
          </div>
        </div>
      </section>
    </MedicaoShell>
  );
}
