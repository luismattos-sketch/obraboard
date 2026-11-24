import Link from "next/link";
import type { ResponsavelRef } from "@/lib/dominio/quadro";
import { lembrarResponsavel } from "./acoes";

const botao =
  "flex min-h-14 items-center justify-center rounded-botao border border-operacional bg-superficie px-4 text-lg font-semibold text-primaria hover:bg-primaria-clara focus-visible:outline-2 focus-visible:outline-operacional";

/** "Quem é você?": a escolha fica na URL (?r=); "Sou eu" a lembra num cookie só deste link (nunca localStorage). */
export function EscolhaResponsavel({ responsaveis }: { responsaveis: ResponsavelRef[] }) {
  return (
    <section aria-labelledby="titulo-quem" className="flex flex-col gap-3">
      <h2 id="titulo-quem" className="text-lg font-semibold text-primaria">Quem é você?</h2>
      {responsaveis.map((r) => (
        <Link key={r.id} href={`?r=${r.id}&confirmar=1`} className={botao}>
          {r.nome}
        </Link>
      ))}
      <Link href="?r=todos" className={`${botao} border-borda text-texto-suave`}>
        Ver tudo
      </Link>
    </section>
  );
}

/** Escolheu na lista: confirma antes de abrir a tela para lançar (evita lançar como outra pessoa). */
export function ConfirmarResponsavel({ token, responsavel }: { token: string; responsavel: ResponsavelRef }) {
  return (
    <section aria-labelledby="titulo-confirmar" className="flex flex-col gap-3">
      <h2 id="titulo-confirmar" className="text-lg font-semibold text-primaria">Você é {responsavel.nome}?</h2>
      <p className="text-sm text-texto-suave">Tudo o que você lançar vai ficar no nome de {responsavel.nome}.</p>
      <form action={lembrarResponsavel.bind(null, token, responsavel.id)} className="flex flex-col">
        <button type="submit" className={botao}>
          Sou eu
        </button>
      </form>
      <Link href="?trocar=1" className={`${botao} border-borda text-texto-suave`}>
        Não, voltar
      </Link>
    </section>
  );
}
