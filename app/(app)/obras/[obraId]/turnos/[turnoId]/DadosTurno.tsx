"use client";

import { useActionState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import type { Resultado } from "@/lib/db/resultado";
import { horaCurta } from "@/lib/dominio/formato";
import type { Periodo } from "@/lib/dominio/tipos";
import { CamposTurno } from "../CamposTurno";
import type { EstadoFormTurno } from "../formTurno";
import { editarDadosTurnoAcao, excluirTurnoAcao } from "./acoesDados";

export const CONFIRMAR_EXCLUSAO = "Excluir este turno e todas as atividades?";

type Props = {
  turnoId: string;
  data: string;
  periodo: Periodo;
  hora_inicio_prevista: string | null;
  hora_fim_prevista: string | null;
};

/** Turno planejado: editar data/período/horários previstos ou excluir o turno. */
export function DadosTurno({ turnoId, data, periodo, hora_inicio_prevista, hora_fim_prevista }: Props) {
  const [estado, salvar, salvando] = useActionState<EstadoFormTurno, FormData>(editarDadosTurnoAcao, null);
  const [estadoExcluir, excluir, excluindo] = useActionState<Resultado<undefined> | null, FormData>(excluirTurnoAcao, null);
  const erro = estado && !estado.ok ? estado : null;
  const inicial = {
    data,
    periodo,
    hora_inicio_prevista: horaCurta(hora_inicio_prevista),
    hora_fim_prevista: horaCurta(hora_fim_prevista),
  };

  return (
    <Cartao className="flex flex-col gap-3">
      <details className="group">
        <summary className="cursor-pointer text-lg font-semibold text-texto">Editar dados do turno</summary>
        <form action={salvar} className="mt-3 flex flex-col gap-4">
          <input type="hidden" name="turno_id" value={turnoId} />
          {/* key: depois de salvar, os campos partem dos dados novos do servidor */}
          <CamposTurno
            key={`${data}-${periodo}-${inicial.hora_inicio_prevista}-${inicial.hora_fim_prevista}`}
            inicial={inicial}
            valores={erro?.valores}
            envio={erro?.envio}
          />
          {erro && <Aviso tom="perigo">{erro.erro}</Aviso>}
          {estado?.ok && <Aviso tom="sucesso">Dados do turno salvos</Aviso>}
          <Botao type="submit" carregando={salvando}>Salvar dados do turno</Botao>
        </form>
      </details>
      <form
        action={excluir}
        onSubmit={(e) => {
          if (!window.confirm(CONFIRMAR_EXCLUSAO)) e.preventDefault();
        }}
      >
        <input type="hidden" name="turno_id" value={turnoId} />
        <Botao type="submit" variante="perigo" carregando={excluindo} className="w-full">
          Excluir turno
        </Botao>
      </form>
      {estadoExcluir && !estadoExcluir.ok && <Aviso tom="perigo">{estadoExcluir.erro}</Aviso>}
    </Cartao>
  );
}
