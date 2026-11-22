"use client";

import { useActionState, useState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { fimPadraoParada, linhaOcorrencia, type Janela, type Ocorrencia } from "@/lib/dominio/efetivoHH";
import { fecharTurnoAcao, reabrirTurnoAcao, type EstadoFechamento } from "./acoes";

export const TEXTO_CONFIRMACAO = "Depois de fechado, o RDO fica definitivo e o link para de aceitar lançamentos.";
export const TEXTO_REABERTURA = "O motivo fica registrado no histórico e no próximo RDO oficial.";

type Props = {
  turnoId: string;
  fechado: boolean;
  salvando?: boolean;
  /** Paradas sem fim: o fechamento pede o horário de cada uma (sugestão: fim do turno). */
  abertas?: Ocorrencia[];
  janela?: Janela | null;
  nome?: (id: string | null) => string;
  /** Chamado ao tocar "Fechar turno": true = falta algo (ex.: causa), não abre a confirmação. */
  aoBloquear?: () => boolean;
};

export function ParadasNoFechamento({
  abertas,
  janela,
  nome,
}: {
  abertas: Ocorrencia[];
  janela: Janela | null;
  nome: (id: string | null) => string;
}) {
  if (abertas.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium text-texto">Paradas sem fim — até que horas ficaram parados?</p>
      {abertas.map((o) => (
        <label key={o.id} className="flex flex-col gap-1 text-sm text-texto">
          {linhaOcorrencia(o, nome)}
          <input
            type="time"
            name={`fim_${o.id}`}
            defaultValue={fimPadraoParada(o, janela)}
            className="min-h-12 w-36 rounded-botao border border-borda bg-superficie px-3 text-base text-texto"
          />
        </label>
      ))}
    </div>
  );
}

export function AcoesTurno({ turnoId, fechado, salvando, abertas = [], janela = null, nome = () => "", aoBloquear }: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const [pedindoMotivo, setPedindoMotivo] = useState(false);
  const [estadoFechar, fechar, fechando] = useActionState<EstadoFechamento, FormData>(fecharTurnoAcao, null);
  const [estadoReabrir, reabrir, reabrindo] = useActionState<EstadoFechamento, FormData>(reabrirTurnoAcao, null);
  const erro = [estadoFechar, estadoReabrir].find((e) => e && !e.ok);

  return (
    <Cartao className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        {fechado ? (
          !pedindoMotivo && (
            <Botao type="button" variante="secundario" onClick={() => setPedindoMotivo(true)}>
              Reabrir turno
            </Botao>
          )
        ) : (
          !confirmando && (
            <Botao type="button" disabled={salvando} onClick={() => {
              if (aoBloquear?.()) return;
              setConfirmando(true);
            }}>
              {salvando ? "Salvando…" : "Fechar turno"}
            </Botao>
          )
        )}
      </div>

      {!fechado && confirmando && (
        <form action={fechar} className="flex flex-col gap-3">
          <input type="hidden" name="turno_id" value={turnoId} />
          <ParadasNoFechamento abertas={abertas} janela={janela} nome={nome} />
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
      {fechado && pedindoMotivo && (
        <form action={reabrir} className="flex flex-col gap-3">
          <input type="hidden" name="turno_id" value={turnoId} />
          <label htmlFor="motivo-reabertura" className="text-sm font-medium text-texto">
            Motivo da reabertura
          </label>
          <textarea
            id="motivo-reabertura"
            name="motivo"
            required
            minLength={3}
            maxLength={500}
            rows={3}
            className="rounded-botao border border-borda bg-superficie px-3 py-2 text-base text-texto focus-visible:outline-2 focus-visible:outline-operacional"
          />
          <Aviso tom="info">{TEXTO_REABERTURA}</Aviso>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Botao type="submit" carregando={reabrindo}>
              Confirmar reabertura
            </Botao>
            <Botao type="button" variante="secundario" onClick={() => setPedindoMotivo(false)}>
              Cancelar
            </Botao>
          </div>
        </form>
      )}
      {erro && !erro.ok && <Aviso tom="perigo">{erro.erro}</Aviso>}
    </Cartao>
  );
}
