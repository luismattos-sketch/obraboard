"use client";

import { useRef, useState } from "react";
import type { Resultado } from "@/lib/db/resultado";
import { FUNCOES_SUGERIDAS } from "@/lib/dominio/tipos";
import { IndicadorSalvo } from "./IndicadorSalvo";
import { useAutoSalvar } from "./useAutoSalvar";

type Linha = { chave: number; funcao: string; quantidade: string };
type Props = {
  inicial: { funcao: string; quantidade: number }[];
  somenteLeitura?: boolean;
  salvar: (linhas: { funcao: string; quantidade: number }[]) => Promise<Resultado<unknown>>;
};
const campo =
  "min-h-12 rounded-lg border border-borda bg-superficie px-3 text-base text-texto focus-visible:outline-2 focus-visible:outline-primaria disabled:opacity-70";

export function BlocoEfetivo({ inicial, somenteLeitura, salvar }: Props) {
  const proxima = useRef(inicial.length);
  const [linhas, setLinhas] = useState<Linha[]>(
    inicial.map((l, i) => ({ chave: i, funcao: l.funcao, quantidade: String(l.quantidade) })),
  );

  // Só vão para o servidor linhas completas e válidas (a linha em digitação fica local).
  const validas = linhas
    .map((l) => ({ funcao: l.funcao.trim(), quantidade: Number(l.quantidade) }))
    .filter((l) => l.funcao && Number.isInteger(l.quantidade) && l.quantidade > 0);
  const estado = useAutoSalvar(() => salvar(validas), [validas]);

  const mudar = (chave: number, p: Partial<Linha>) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...p } : l)));

  return (
    <section aria-labelledby="titulo-efetivo" className="flex flex-col gap-3">
      <h2 id="titulo-efetivo" className="text-lg font-semibold">Efetivo</h2>
      <datalist id="funcoes-sugeridas">
        {FUNCOES_SUGERIDAS.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      {linhas.map((l) => (
        <div key={l.chave} className="flex items-center gap-2">
          <input
            aria-label="Função"
            list="funcoes-sugeridas"
            maxLength={60}
            className={`${campo} min-w-0 flex-1`}
            placeholder="Função"
            value={l.funcao}
            disabled={somenteLeitura}
            onChange={(e) => mudar(l.chave, { funcao: e.target.value })}
          />
          <input
            aria-label="Quantidade"
            inputMode="numeric"
            maxLength={3}
            className={`${campo} w-20 text-center`}
            placeholder="Qtd"
            value={l.quantidade}
            disabled={somenteLeitura}
            onChange={(e) => mudar(l.chave, { quantidade: e.target.value.replace(/\D/g, "") })}
          />
          {!somenteLeitura && (
            <button
              type="button"
              aria-label="Remover linha"
              className="min-h-12 min-w-12 rounded-lg border border-borda text-perigo"
              onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {!somenteLeitura && (
        <button
          type="button"
          className="min-h-12 rounded-lg border border-borda bg-superficie font-semibold text-primaria hover:bg-primaria-clara"
          onClick={() => setLinhas((ls) => [...ls, { chave: proxima.current++, funcao: "", quantidade: "" }])}
        >
          + Adicionar função
        </button>
      )}
      {!somenteLeitura && <IndicadorSalvo {...estado} />}
    </section>
  );
}
