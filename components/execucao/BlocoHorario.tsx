"use client";

import { useState } from "react";
import type { Resultado } from "@/lib/db/resultado";
import { IndicadorSalvo } from "./IndicadorSalvo";
import { useAutoSalvar } from "./useAutoSalvar";

type Props = {
  /** "HH:MM" ou "". */
  inicio: string;
  fim: string;
  somenteLeitura?: boolean;
  salvar: (dados: { hora_inicio_real: string | null; hora_fim_real: string | null }) => Promise<Resultado<unknown>>;
};
const campo =
  "min-h-12 w-full rounded-lg border border-borda bg-superficie px-3 text-base text-texto focus-visible:outline-2 focus-visible:outline-primaria disabled:opacity-70";

export function BlocoHorario({ inicio, fim, somenteLeitura, salvar }: Props) {
  const [ini, setIni] = useState(inicio);
  const [fi, setFi] = useState(fim);
  const estado = useAutoSalvar(() => salvar({ hora_inicio_real: ini || null, hora_fim_real: fi || null }), [ini, fi]);

  return (
    <section aria-labelledby="titulo-horario" className="flex flex-col gap-3">
      <h2 id="titulo-horario" className="text-lg font-semibold">Horário real</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="hora-inicio" className="text-sm font-medium">Início</label>
          <input id="hora-inicio" type="time" className={campo} value={ini} disabled={somenteLeitura} onChange={(e) => setIni(e.target.value)} />
        </div>
        <div>
          <label htmlFor="hora-fim" className="text-sm font-medium">Fim</label>
          <input id="hora-fim" type="time" className={campo} value={fi} disabled={somenteLeitura} onChange={(e) => setFi(e.target.value)} />
        </div>
      </div>
      {!somenteLeitura && <IndicadorSalvo {...estado} />}
    </section>
  );
}
