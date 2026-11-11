"use client";

import { useActionState, useState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { fecharTurnoAcao, reabrirTurnoAcao, type EstadoFechamento } from "./acoes";

export const TEXTO_CONFIRMACAO = "Depois de fechado, o RDO fica definitivo e o link para de aceitar lançamentos.";

type Props = { turnoId: string; fechado: boolean; salvando?: boolean };

export function AcoesTurno({ turnoId, fechado, salvando }: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const [estadoFechar, fechar, fechando] = useActionState<EstadoFechamento, FormData>(fecharTurnoAcao, null);
  const [estadoReabrir, reabrir, reabrindo] = useActionState<EstadoFechamento, FormData>(reabrirTurnoAcao, null);
  const erro = [estadoFechar, estadoReabrir].find((e) => e && !e.ok);

  return (
    <Cartao className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        {fechado ? (
          <form action={reabrir}>
            <input type="hidden" name="turno_id" value={turnoId} />
            <Botao type="submit" variante="secundario" carregando={reabrindo} className="w-full">
              Reabrir turno
            </Botao>
          </form>
        ) : (
          !confirmando && (
            <Botao type="button" disabled={salvando} onClick={() => setConfirmando(true)}>
              {salvando ? "Salvando…" : "Fechar turno"}
            </Botao>
          )
        )}
      </div>

      {!fechado && confirmando && (
        <form action={fechar} className="flex flex-col gap-3">
          <input type="hidden" name="turno_id" value={turnoId} />
          <Aviso tom="alerta">{TEXTO_CONFIRMACAO}</Aviso>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Botao type="submit" carregando={fechando} disabled={salvando}>
              Confirmar fechamento
            </Botao>
            <Botao type="button" variante="secundario" onClick={() => setConfirmando(false)}>
              Cancelar
            </Botao>
          </div>
        </form>
      )}
      {erro && !erro.ok && <Aviso tom="perigo">{erro.erro}</Aviso>}
    </Cartao>
  );
}
