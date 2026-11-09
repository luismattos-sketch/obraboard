"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import DesktopLayout from "../../../components/DesktopLayout";

const abasMedicao = [
  {
    href: "/medicao/contrato",
    label: "Contrato",
    descricao: "Cadastro e organização dos dados contratuais.",
  },
  {
    href: "/medicao/medir",
    label: "Medir",
    descricao: "Lançamento e acompanhamento das medições.",
  },
];

export default function MedicaoShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <DesktopLayout
      titulo="Medição"
      subtitulo="Contratos e medições da frente"
    >
      <div className="space-y-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            {abasMedicao.map((aba) => {
              const ativa = pathname === aba.href;

              return (
                <Link
                  key={aba.href}
                  href={aba.href}
                  className={`rounded-2xl border p-4 transition ${
                    ativa
                      ? "border-orange-500 bg-orange-50 text-slate-950"
                      : "border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:bg-orange-50/60"
                  }`}
                >
                  <span className="text-lg font-bold">{aba.label}</span>
                  <span className="mt-1 block text-sm text-slate-500">
                    {aba.descricao}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {children}
      </div>
    </DesktopLayout>
  );
}
