"use client";

import { useActionState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import type { Atividade } from "@/lib/db/atividades";
import { trazerPendentesAcao, type EstadoAcao } from "./acoes";
import { FormAtividade } from "./FormAtividade";
import { ItemAtividade } from "./ItemAtividade";

export function ListaAtividades({
  turnoId,
  atividades,
  trazerPendentes = true,
}: {
  turnoId: string;
  atividades: Atividade[];
  /** "Trazer pendentes" só faz sentido antes de liberar para campo. */
  trazerPendentes?: boolean;
}) {
  const [estado, action, pendente] = useActionState<EstadoAcao, FormData>(trazerPendentesAcao, null);
  return (
    <div className="flex flex-col gap-4">
      <Cartao className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-primaria">Atividades planejadas</h2>
        {atividades.length === 0 ? (
          <p className="text-texto-suave">Nenhuma atividade ainda.</p>
        ) : (
          <ul className="divide-y divide-borda">
            {atividades.map((a, i) => (
              <ItemAtividade key={a.id} atividade={a} primeira={i === 0} ultima={i === atividades.length - 1} />
            ))}
          </ul>
        )}
      </Cartao>

      {trazerPendentes && (
        <form action={action} className="flex flex-col gap-2">
          <input type="hidden" name="turno_id" value={turnoId} />
          <Botao type="submit" variante="secundario" carregando={pendente}>
            Trazer pendentes do turno anterior
          </Botao>
          {estado && !estado.ok && <Aviso tom="alerta">{estado.erro}</Aviso>}
          {estado?.ok && estado.dados?.mensagem && <Aviso tom="sucesso">{estado.dados.mensagem}</Aviso>}
        </form>
      )}

      <Cartao>
        <h2 className="mb-3 text-lg font-semibold text-primaria">Adicionar atividade</h2>
        <FormAtividade key={atividades.length} turnoId={turnoId} />
      </Cartao>
    </div>
  );
}
