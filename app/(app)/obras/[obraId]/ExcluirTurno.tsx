"use client";

import { useActionState } from "react";
import type { Resultado } from "@/lib/db/resultado";
import { excluirTurnoAcao } from "./turnos/[turnoId]/acoesDados";

/** Lixeira ao lado do turno na lista da obra. Vale para qualquer status (apaga também RDOs e check-in). */
export function ExcluirTurno({ turnoId, rotulo, planejado }: { turnoId: string; rotulo: string; planejado: boolean }) {
  const [estado, excluir, excluindo] = useActionState<Resultado<undefined> | null, FormData>(excluirTurnoAcao, null);
  const aviso = planejado
    ? `Excluir o turno ${rotulo} e todas as atividades?`
    : `Excluir o turno ${rotulo}? Isso apaga atividades, efetivo, RDOs e check-in deste turno, sem volta.`;
  return (
    <form
      action={excluir}
      onSubmit={(e) => {
        if (!window.confirm(aviso)) e.preventDefault();
      }}
      className="flex flex-col items-center justify-center"
    >
      <input type="hidden" name="turno_id" value={turnoId} />
      <button
        type="submit"
        disabled={excluindo}
        aria-label={`Excluir turno ${rotulo}`}
        title="Excluir turno"
        className="rounded-cartao p-3 text-texto-suave transition-colors hover:bg-perigo-clara hover:text-perigo disabled:opacity-50"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
        </svg>
      </button>
      {estado && !estado.ok && <p className="text-xs text-perigo">{estado.erro}</p>}
    </form>
  );
}
