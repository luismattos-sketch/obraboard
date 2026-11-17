"use client";

import { EditarIntervalo } from "@/components/execucao/EditarIntervalo";
import { Cartao } from "@/components/ui/Cartao";
import type { IntervalosObra } from "@/lib/db/obras";
import { salvarIntervaloObraAcao } from "./acoesIntervalo";

/** Intervalo de refeição padrão da obra; cada turno novo guarda uma cópia (turnos já criados não mudam). */
export function IntervaloObra({ obraId, intervalos }: { obraId: string; intervalos: IntervalosObra }) {
  return (
    <Cartao className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-primaria">Intervalo de refeição</h2>
        <p className="text-sm text-texto-suave">Descontado do HH. Vale para os turnos criados depois da mudança.</p>
      </div>
      <EditarIntervalo rotulo="Diurno" inicial={intervalos.diurno} salvar={(j) => salvarIntervaloObraAcao(obraId, "diurno", j)} />
      <EditarIntervalo rotulo="Noturno" inicial={intervalos.noturno} salvar={(j) => salvarIntervaloObraAcao(obraId, "noturno", j)} />
    </Cartao>
  );
}
