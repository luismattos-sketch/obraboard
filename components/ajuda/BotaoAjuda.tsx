import Link from "next/link";
import { destinoAjuda, type TelaAjuda } from "@/lib/ajuda/destino";

/** "?" no cabeçalho da tela: abre o capítulo do manual que explica aquela tela. */
export function BotaoAjuda({ tela }: { tela: TelaAjuda }) {
  return (
    <Link href={destinoAjuda(tela)} aria-label="Ajuda sobre esta tela" title="Ajuda sobre esta tela"
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-borda bg-superficie text-lg font-semibold text-primaria hover:bg-primaria-clara focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-operacional">
      ?
    </Link>
  );
}
