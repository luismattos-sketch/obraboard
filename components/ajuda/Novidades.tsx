import Link from "next/link";
import { formatarData } from "@/lib/dominio/formato";
import type { Novidade } from "@/lib/ajuda/tipos";

const VISIVEIS = 3;

function Item({ n }: { n: Novidade }) {
  return (
    <li className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <span className="shrink-0 text-sm text-texto-suave">{formatarData(n.data)}</span>
      <Link href={n.href} className="text-texto underline-offset-2 hover:underline">{n.texto}</Link>
    </li>
  );
}

/** As 3 novidades mais recentes; as demais em "Ver todas" (acordeão nativo, sem guardar nada no navegador). */
export function Novidades({ novidades }: { novidades: Novidade[] }) {
  const resto = novidades.slice(VISIVEIS);
  return (
    <section aria-labelledby="titulo-novidades" className="flex flex-col gap-2">
      <h2 id="titulo-novidades" className="text-lg font-semibold text-primaria">Novidades</h2>
      <ul className="flex flex-col gap-2">
        {novidades.slice(0, VISIVEIS).map((n) => <Item key={n.data + n.texto} n={n} />)}
      </ul>
      {resto.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-operacional underline">Ver todas</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {resto.map((n) => <Item key={n.data + n.texto} n={n} />)}
          </ul>
        </details>
      )}
    </section>
  );
}
