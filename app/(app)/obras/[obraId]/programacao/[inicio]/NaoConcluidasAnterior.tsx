"use client";

import { Botao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { qtdComUnidade } from "@/lib/dominio/plural";
import type { ResponsavelRef } from "@/lib/dominio/quadro";
import type { PendenteAnterior } from "@/lib/dominio/trazerSaldo";

/** Item 1.6: o que ficou com saldo na semana anterior, para trazer com um toque. */
export function NaoConcluidasAnterior({
  pendentes,
  trazidas,
  responsaveis,
  aoTrazer,
}: {
  pendentes: PendenteAnterior[];
  /** Ids de origem já trazidos para esta semana. */
  trazidas: Set<string>;
  responsaveis: ResponsavelRef[];
  aoTrazer: (p: PendenteAnterior) => void;
}) {
  if (pendentes.length === 0) return null;
  return (
    <Cartao className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold text-primaria">Não concluídas da semana anterior</h2>
        <p className="text-sm text-texto-suave">Traga o que ficou com saldo. A semana anterior continua “não cumprida”, com a causa dela.</p>
      </div>
      <ul className="divide-y divide-borda">
        {pendentes.map((p) => {
          const a = p.origem;
          const nome = a.responsavel_id ? responsaveis.find((r) => r.id === a.responsavel_id)?.nome : null;
          return (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-texto">
                  {a.descricao}
                  {a.local ? <span className="font-normal text-texto-suave"> · {a.local}</span> : null}
                </p>
                <p className="text-sm text-texto-suave">
                  faltam {qtdComUnidade(p.saldo, a.unidade)} de {qtdComUnidade(p.metaTotal, a.unidade)}
                </p>
                <p className="text-sm text-texto-suave">Responsável: {nome ?? "sem responsável"}</p>
              </div>
              {trazidas.has(a.id) ? (
                <span className="text-sm font-semibold text-sucesso">Trazida ✓</span>
              ) : (
                <Botao type="button" variante="secundario" className="min-h-10 px-3 text-sm" onClick={() => aoTrazer(p)}>
                  Trazer
                </Botao>
              )}
            </li>
          );
        })}
      </ul>
    </Cartao>
  );
}
