"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao, classesBotao } from "@/components/ui/Botao";
import { Campo } from "@/components/ui/Campo";
import type { Periodo } from "@/lib/dominio/tipos";
import { novoTurno, type EstadoNovoTurno } from "./acoes";

const HORARIOS: Record<Periodo, { inicio: string; fim: string }> = {
  diurno: { inicio: "07:00", fim: "17:00" },
  noturno: { inicio: "19:00", fim: "05:00" },
};

export function FormNovoTurno({ obraId, hoje }: { obraId: string; hoje: string }) {
  const [estado, action, pendente] = useActionState<EstadoNovoTurno, FormData>(novoTurno, null);
  const [periodo, setPeriodo] = useState<Periodo>("diurno");
  const erro = estado && !estado.ok ? estado : null;
  const v = erro?.valores;
  const horaDe = (k: "hora_inicio_prevista" | "hora_fim_prevista", padrao: string) =>
    v && v.periodo === periodo ? v[k] : padrao;
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="obra_id" value={obraId} />
      <Campo key={`d${erro?.envio ?? 0}`} rotulo="Data" name="data" type="date" defaultValue={v?.data ?? hoje} required erro={erro?.campos?.data} />
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
      <div key={`${periodo}-${erro?.envio ?? 0}`} className="grid grid-cols-2 gap-3">
        <Campo rotulo="Início previsto" name="hora_inicio_prevista" type="time" defaultValue={horaDe("hora_inicio_prevista", HORARIOS[periodo].inicio)} />
        <Campo rotulo="Fim previsto" name="hora_fim_prevista" type="time" defaultValue={horaDe("hora_fim_prevista", HORARIOS[periodo].fim)} />
      </div>
      {erro && <Aviso tom="perigo">{erro.erro}</Aviso>}
      <Botao type="submit" carregando={pendente}>Criar turno</Botao>
      <Link href={`/obras/${obraId}`} className={classesBotao("secundario")}>Cancelar</Link>
    </form>
  );
}
