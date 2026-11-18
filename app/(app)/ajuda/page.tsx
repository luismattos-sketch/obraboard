import type { Metadata } from "next";
import Link from "next/link";
import { BuscaAjuda } from "@/components/ajuda/BuscaAjuda";
import { Fluxograma } from "@/components/ajuda/Fluxograma";
import { Novidades } from "@/components/ajuda/Novidades";
import { capitulosDoIndice } from "@/lib/ajuda/capitulos";
import { FLUXOGRAMA } from "@/lib/ajuda/fluxograma";
import { NOVIDADES } from "@/lib/ajuda/novidades";

export const metadata: Metadata = { title: "Ajuda | Frentia" };

export default function PaginaAjuda() {
  return (
    <div className="flex min-w-0 max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-titulo font-semibold text-primaria">Ajuda</h1>
        <BuscaAjuda />
      </div>

      <Novidades novidades={NOVIDADES} />

      <section aria-labelledby="titulo-fluxo" className="flex flex-col gap-3">
        <h2 id="titulo-fluxo" className="text-lg font-semibold text-primaria">Como o Frentia funciona</h2>
        <Fluxograma fases={FLUXOGRAMA} />
      </section>

      <section aria-labelledby="titulo-capitulos" className="flex flex-col gap-3">
        <h2 id="titulo-capitulos" className="text-lg font-semibold text-primaria">Passo a passo</h2>
        <ol className="grid gap-3 sm:grid-cols-2">
          {capitulosDoIndice().map((c, i) => (
            <li key={c.slug}>
              <Link href={`/ajuda/${c.slug}`}
                className="flex h-full flex-col gap-1 rounded-cartao border border-borda bg-superficie p-4 shadow-sm hover:border-operacional">
                <span className="font-semibold text-primaria">{i + 1}. {c.titulo}</span>
                <span className="text-sm text-texto-suave">{c.resumo}</span>
              </Link>
            </li>
          ))}
        </ol>
        <p className="text-sm text-texto-suave">
          O que o responsável vê no link de campo: <Link href="/ajuda/campo" className="text-operacional underline">Como usar (responsável de campo)</Link>.
        </p>
      </section>
    </div>
  );
}
