"use client";

import { useState } from "react";
import { IndicadorSalvo } from "@/components/execucao/IndicadorSalvo";
import { useAutoSalvar } from "@/components/execucao/useAutoSalvar";
import { LIMITES } from "@/lib/db/validacao";
import { salvarNomeEmpresaAcao } from "./acoes";

const campo =
  "min-h-12 w-full rounded-botao border border-borda bg-superficie px-3 text-base text-texto focus-visible:outline-2 focus-visible:outline-operacional";

/** Nome que sai no cabeçalho de todo RDO; salva sozinho. */
export function NomeEmpresa({ inicial }: { inicial: string }) {
  const [valor, setValor] = useState(inicial);
  const salvar = useAutoSalvar(() => salvarNomeEmpresaAcao(valor), [valor.trim()]);
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">
        Nome da empresa (aparece no RDO)
        <input type="text" className={campo} value={valor} maxLength={LIMITES.empresa} onChange={(e) => setValor(e.target.value)} />
      </label>
      <IndicadorSalvo {...salvar} dica="Salva sozinho." />
    </div>
  );
}
