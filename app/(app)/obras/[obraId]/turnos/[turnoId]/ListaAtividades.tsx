"use client";

import { Fragment, useActionState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import type { Atividade } from "@/lib/db/atividades";
import type { StatusSemana } from "@/lib/dominio/programacao";
import { ordenarPorResponsavel, type ResponsavelRef } from "@/lib/dominio/quadro";
import { trazerDaProgramacaoAcao, trazerPendentesAcao, type EstadoAcao } from "./acoes";
import { FormAtividade } from "./FormAtividade";
import { ItemAtividade } from "./ItemAtividade";

export function ListaAtividades({
  turnoId,
  atividades,
  trazerPendentes = true,
  semanaStatus = null,
  obraId,
  responsaveis,
}: {
  turnoId: string;
  obraId: string;
  responsaveis: ResponsavelRef[];
  atividades: Atividade[];
  /** "Trazer pendentes" só faz sentido antes de liberar para campo. */
  trazerPendentes?: boolean;
  /** Status da semana da programação que contém o turno (null: sem programação). */
  semanaStatus?: StatusSemana | null;
}) {
  const [estado, action, pendente] = useActionState<EstadoAcao, FormData>(trazerPendentesAcao, null);
  const [estadoProg, actionProg, pendenteProg] = useActionState<EstadoAcao, FormData>(trazerDaProgramacaoAcao, null);
  const agrupar = atividades.some((a) => a.responsavel_id !== null);
  const nomeDe = (id: string | null) =>
    id === null ? "Sem responsável" : (responsaveis.find((r) => r.id === id)?.nome ?? "—");
  return (
    <div className="flex flex-col gap-4">
      <Cartao className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-primaria">Atividades planejadas</h2>
        {atividades.length === 0 ? (
          <p className="text-texto-suave">Nenhuma atividade ainda.</p>
        ) : (
          <ul className="divide-y divide-borda">
            {ordenarPorResponsavel(atividades, responsaveis).map((a, i, lista) => {
              const grupo = (x: Atividade) => x.responsavel_id;
              const novoGrupo = agrupar && (i === 0 || grupo(lista[i - 1]) !== grupo(a));
              return (
                <Fragment key={a.id}>
                  {novoGrupo && (
                    <li className="pt-3 text-sm font-semibold uppercase tracking-wide text-operacional">
                      {nomeDe(a.responsavel_id)}
                    </li>
                  )}
                  <ItemAtividade
                    atividade={a}
                    primeira={atividades[0]?.id === a.id}
                    ultima={atividades[atividades.length - 1]?.id === a.id}
                    semanaStatus={semanaStatus}
                    obraId={obraId}
                    responsaveis={responsaveis}
                  />
                </Fragment>
              );
            })}
          </ul>
        )}
      </Cartao>

      {trazerPendentes && semanaStatus === "programada" && (
        <form action={actionProg} className="flex flex-col gap-2">
          <input type="hidden" name="turno_id" value={turnoId} />
          <Botao type="submit" variante="secundario" carregando={pendenteProg}>
            Trazer da programação
          </Botao>
          {estadoProg && !estadoProg.ok && <Aviso tom="alerta">{estadoProg.erro}</Aviso>}
          {estadoProg?.ok && estadoProg.dados?.mensagem && <Aviso tom="sucesso">{estadoProg.dados.mensagem}</Aviso>}
        </form>
      )}

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
