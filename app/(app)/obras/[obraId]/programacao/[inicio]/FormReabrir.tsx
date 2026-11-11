"use client";

import { useActionState, useState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import { reabrirSemanaAcao, type EstadoSemana } from "./acoes";

export function FormReabrir({ semanaId, rotulo }: { semanaId: string; rotulo: "Reabrir programação" | "Reabrir" }) {
  const [aberto, setAberto] = useState(false);
  const [estado, action, pendente] = useActionState<EstadoSemana, FormData>(reabrirSemanaAcao, null);
  if (!aberto) {
    return (
      <div>
        <Botao type="button" variante="secundario" onClick={() => setAberto(true)}>
          {rotulo}
        </Botao>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="semana_id" value={semanaId} />
      <label htmlFor="motivo-reabertura-semana" className="text-sm font-medium text-texto">
        Motivo da reabertura
      </label>
      <textarea
        id="motivo-reabertura-semana"
        name="motivo"
        required
        minLength={3}
        maxLength={500}
        rows={3}
        className="rounded-botao border border-borda bg-superficie px-3 py-2 text-base text-texto focus-visible:outline-2 focus-visible:outline-operacional"
      />
      <Aviso tom="info">O motivo fica registrado e a foto anterior continua no histórico.</Aviso>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Botao type="submit" carregando={pendente}>
          Confirmar reabertura
        </Botao>
        <Botao type="button" variante="secundario" onClick={() => setAberto(false)}>
          Cancelar
        </Botao>
      </div>
      {estado && !estado.ok && <Aviso tom="perigo">{estado.erro}</Aviso>}
    </form>
  );
}
