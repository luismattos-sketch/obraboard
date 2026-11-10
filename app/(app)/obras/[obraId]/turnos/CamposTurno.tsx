"use client";

import { useState } from "react";
import { Campo } from "@/components/ui/Campo";
import type { Periodo } from "@/lib/dominio/tipos";

const HORARIOS: Record<Periodo, { inicio: string; fim: string }> = {
  diurno: { inicio: "07:00", fim: "17:00" },
  noturno: { inicio: "19:00", fim: "05:00" },
};

export type ValoresTurno = { data: string; periodo: Periodo; hora_inicio_prevista: string; hora_fim_prevista: string };

/**
 * Data, período e horários previstos (novo turno e edição). `valores`/`envio` vêm da última action
 * com falha: os campos são remontados com o que o usuário digitou.
 */
export function CamposTurno({
  inicial,
  valores,
  envio,
}: {
  inicial: ValoresTurno;
  valores?: Record<string, string>;
  envio?: number;
}) {
  const [periodo, setPeriodo] = useState<Periodo>(inicial.periodo);
  const horaDe = (k: "hora_inicio_prevista" | "hora_fim_prevista") => {
    if (valores && valores.periodo === periodo) return valores[k];
    if (periodo === inicial.periodo) return inicial[k];
    return k === "hora_inicio_prevista" ? HORARIOS[periodo].inicio : HORARIOS[periodo].fim;
  };
  return (
    <>
      <Campo key={`d${envio ?? 0}`} rotulo="Data" name="data" type="date" defaultValue={valores?.data ?? inicial.data} required />
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium text-texto">Período</legend>
        <div className="flex gap-3">
          {(["diurno", "noturno"] as const).map((p) => (
            <label key={p} className="flex min-h-12 flex-1 items-center gap-2 rounded-lg border border-borda bg-superficie px-3">
              <input type="radio" name="periodo" value={p} checked={periodo === p} onChange={() => setPeriodo(p)} />
              {p === "diurno" ? "Diurno" : "Noturno"}
            </label>
          ))}
        </div>
      </fieldset>
      {/* key força o remount ao trocar o período, aplicando o novo horário padrão */}
      <div key={`${periodo}-${envio ?? 0}`} className="grid grid-cols-2 gap-3">
        <Campo rotulo="Início previsto" name="hora_inicio_prevista" type="time" defaultValue={horaDe("hora_inicio_prevista")} />
        <Campo rotulo="Fim previsto" name="hora_fim_prevista" type="time" defaultValue={horaDe("hora_fim_prevista")} />
      </div>
    </>
  );
}

/** Novo turno começa no diurno com o horário padrão. */
export const turnoPadrao = (hoje: string): ValoresTurno => ({
  data: hoje,
  periodo: "diurno",
  hora_inicio_prevista: HORARIOS.diurno.inicio,
  hora_fim_prevista: HORARIOS.diurno.fim,
});
