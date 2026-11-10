"use client";

import { useState } from "react";
import type { Clima } from "@/lib/db/turnos";
import type { Resultado } from "@/lib/db/resultado";
import { tuplaClima } from "@/lib/dominio/assinatura";
import { CONDICOES, PERIODOS_CLIMA, type CondicaoClima, type PeriodoClima } from "@/lib/dominio/tipos";
import { IndicadorSalvo } from "./IndicadorSalvo";
import { Sincronizar } from "./Sincronizar";
import { useAutoSalvar } from "./useAutoSalvar";

type Dados = { periodo: PeriodoClima; condicao: CondicaoClima; impediu: boolean };
type Props = {
  inicial: Clima[];
  somenteLeitura?: boolean;
  salvar: (dados: Dados) => Promise<Resultado<unknown>>;
  /** Apaga o registro do período (escolha "—" depois de um valor salvo). */
  limpar: (periodo: PeriodoClima) => Promise<Resultado<unknown>>;
};

export function BlocoClima({ inicial, somenteLeitura, salvar, limpar }: Props) {
  return (
    <section aria-labelledby="titulo-clima" className="flex flex-col gap-3">
      <h2 id="titulo-clima" className="text-lg font-semibold text-primaria">Clima</h2>
      {PERIODOS_CLIMA.map((p) => {
        const c = inicial.find((x) => x.periodo === p.id);
        return (
          <Sincronizar key={p.id} servidor={tuplaClima(c?.condicao ?? null, c?.impediu ?? false)}>
            <LinhaClima
              periodo={p.id}
              rotulo={p.rotulo}
              inicial={c}
              somenteLeitura={somenteLeitura}
              salvar={salvar}
              limpar={limpar}
            />
          </Sincronizar>
        );
      })}
    </section>
  );
}

function LinhaClima({
  periodo,
  rotulo,
  inicial,
  somenteLeitura,
  salvar,
  limpar,
}: {
  periodo: PeriodoClima;
  rotulo: string;
  inicial?: Clima;
  somenteLeitura?: boolean;
  salvar: Props["salvar"];
  limpar: Props["limpar"];
}) {
  const [condicao, setCondicao] = useState<CondicaoClima | "">(inicial?.condicao ?? "");
  const [impediu, setImpediu] = useState(inicial?.impediu ?? false);
  const estado = useAutoSalvar(async () => {
    if (!condicao) return limpar(periodo);
    return salvar({ periodo, condicao, impediu });
  }, tuplaClima(condicao, impediu));

  return (
    <div className="flex flex-col gap-2 rounded-cartao border border-borda bg-superficie p-3">
      <div className="flex items-center gap-3">
        <label htmlFor={`clima-${periodo}`} className="w-16 text-sm font-medium">{rotulo}</label>
        <select
          id={`clima-${periodo}`}
          className="min-h-12 flex-1 rounded-botao border border-borda bg-superficie px-3 text-base disabled:opacity-70"
          value={condicao}
          disabled={somenteLeitura}
          onChange={(e) => {
            const v = e.target.value as CondicaoClima | "";
            setCondicao(v);
            if (!v) setImpediu(false);
          }}
        >
          <option value="">—</option>
          {(Object.keys(CONDICOES) as CondicaoClima[]).map((k) => (
            <option key={k} value={k}>{CONDICOES[k]}</option>
          ))}
        </select>
      </div>
      <label className="flex min-h-12 items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="h-6 w-6"
          checked={impediu}
          disabled={somenteLeitura || !condicao}
          onChange={(e) => setImpediu(e.target.checked)}
        />
        Impediu o trabalho
      </label>
      {!somenteLeitura && <IndicadorSalvo {...estado} />}
    </div>
  );
}
