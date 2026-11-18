import Link from "next/link";
import { Fragment } from "react";
import type { Ator, FaseFluxo } from "@/lib/ajuda/tipos";

const COR: Record<Ator, string> = {
  planejador: "bg-primaria text-white hover:bg-primaria-escura",
  campo: "bg-destaque text-white hover:bg-destaque-escura",
  tv: "border border-dashed border-primaria bg-primaria-clara text-primaria hover:bg-superficie",
};

const LEGENDA: { ator: Ator; rotulo: string }[] = [
  { ator: "planejador", rotulo: "Planejador" },
  { ator: "campo", rotulo: "Responsável de campo (link, sem login)" },
  { ator: "tv", rotulo: "Quadro na TV (só mostra)" },
];

const Seta = ({ para }: { para: "lado" | "baixo" }) => (
  <span aria-hidden="true" className={`font-bold text-texto-suave ${para === "baixo" ? "block text-center" : ""}`}>
    {para === "baixo" ? "↓" : "→"}
  </span>
);

/** "Como o Frentia funciona": fases empilhadas; as caixas de cada linha quebram para baixo no celular. */
export function Fluxograma({ fases }: { fases: FaseFluxo[] }) {
  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-texto" aria-label="Legenda">
        {LEGENDA.map((l) => (
          <li key={l.ator} className="flex items-center gap-2">
            <span aria-hidden="true" className={`inline-block h-3.5 w-3.5 rounded ${COR[l.ator]}`} />
            {l.rotulo}
          </li>
        ))}
      </ul>

      <div aria-hidden="true" className="flex flex-col gap-1">
        {fases.map((fase, i) => (
          <Fragment key={fase.titulo}>
            {i > 0 && <Seta para="baixo" />}
            <section className="rounded-cartao border border-borda bg-superficie p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-texto-suave">
                {i + 1} · {fase.titulo}
              </h3>
              {fase.linhas.map((linha, j) => (
                <Fragment key={j}>
                  {j > 0 && <Seta para="baixo" />}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {linha.map((cx, k) => (
                      <Fragment key={cx.rotulo}>
                        {k > 0 && <Seta para="lado" />}
                        <Link href={cx.href} tabIndex={-1}
                          className={`rounded-botao px-2.5 py-1.5 text-sm font-semibold leading-tight ${COR[cx.ator]}`}>
                          {cx.rotulo}
                          {cx.detalhe && <small className="block text-xs font-normal opacity-85">{cx.detalhe}</small>}
                        </Link>
                      </Fragment>
                    ))}
                  </div>
                </Fragment>
              ))}
              {fase.nota && <p className="mt-2 text-sm text-texto-suave">{fase.nota}</p>}
            </section>
          </Fragment>
        ))}
      </div>

      <ol className="sr-only">
        {fases.map((fase) => (
          <li key={fase.titulo}>
            {fase.titulo}:
            <ol>
              {fase.linhas.flat().map((cx) => (
                <li key={cx.rotulo}>
                  <Link href={cx.href}>{cx.rotulo}{cx.detalhe ? ` (${cx.detalhe})` : ""}</Link>
                </li>
              ))}
            </ol>
            {fase.nota}
          </li>
        ))}
      </ol>
    </figure>
  );
}
