"use client";

import { useState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { buscarClimaDeNovo } from "./acoesExecucao";

/** Turno enviado sem clima (serviço fora do ar na hora): tenta de novo. */
export function BuscarClima({ turnoId }: { turnoId: string }) {
  const [erro, setErro] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  return (
    <div className="mt-2 flex flex-col gap-2">
      <button
        type="button"
        disabled={buscando}
        className="min-h-12 rounded-botao border border-operacional bg-superficie px-3 font-semibold text-primaria hover:bg-primaria-clara disabled:opacity-70"
        onClick={async () => {
          setBuscando(true);
          setErro(null);
          try {
            const r = await buscarClimaDeNovo(turnoId);
            if (!r.ok) setErro(r.erro);
          } catch {
            setErro("Sem conexão — tente de novo.");
          } finally {
            setBuscando(false);
          }
        }}
      >
        {buscando ? "Buscando…" : "Buscar clima de novo"}
      </button>
      {erro && <Aviso tom="perigo">{erro}</Aviso>}
    </div>
  );
}
