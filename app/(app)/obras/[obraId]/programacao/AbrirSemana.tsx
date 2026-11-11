"use client";

import { useActionState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import { Campo } from "@/components/ui/Campo";
import { abrirSemanaAcao, type EstadoAbrir } from "./acoes";

/** Botão de uma data fixa (ex.: "Programar próxima semana") ou seletor de data ("Abrir semana"). */
export function AbrirSemana({
  obraId,
  data,
  rotulo,
  comSeletor = false,
  variante = "destaque",
}: {
  obraId: string;
  data: string;
  rotulo: string;
  comSeletor?: boolean;
  variante?: "destaque" | "secundario";
}) {
  const [estado, action, pendente] = useActionState<EstadoAbrir, FormData>(abrirSemanaAcao, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="obra_id" value={obraId} />
      {comSeletor ? (
        <div className="flex flex-wrap items-end gap-2">
          <Campo rotulo="Data da semana" name="data" type="date" defaultValue={data} required />
          <Botao type="submit" variante={variante} carregando={pendente}>
            {rotulo}
          </Botao>
        </div>
      ) : (
        <>
          <input type="hidden" name="data" value={data} />
          <Botao type="submit" variante={variante} carregando={pendente}>
            {rotulo}
          </Botao>
        </>
      )}
      {estado && !estado.ok && <Aviso tom="alerta">{estado.erro}</Aviso>}
    </form>
  );
}
