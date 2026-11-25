"use client";

import { useActionState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import type { AtividadeProgramada } from "@/lib/dominio/programacao";
import { textoSaldoMudou } from "@/lib/dominio/trazerSaldo";
import { atualizarMetaTrazidaAcao, type EstadoSemana } from "./acoes";

/** Item 1.6: a semana anterior lançou depois do "Trazer"; o planejador decide se a meta acompanha. */
export function AvisoSaldoMudou({ atividade, saldoAtual }: { atividade: AtividadeProgramada; saldoAtual: number }) {
  const [estado, action, pendente] = useActionState<EstadoSemana, FormData>(atualizarMetaTrazidaAcao, null);
  const texto = textoSaldoMudou(atividade.saldo_trazido ?? atividade.meta, saldoAtual, atividade.unidade);
  if (!texto) return null;
  return (
    <div className="flex flex-col gap-2">
      <Aviso tom="info">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>{texto}</span>
          {saldoAtual > 0 && (
            <form action={action}>
              <input type="hidden" name="atividade_id" value={atividade.id} />
              <Botao type="submit" variante="secundario" className="min-h-10 px-3 text-sm" carregando={pendente}>
                Atualizar meta
              </Botao>
            </form>
          )}
        </div>
      </Aviso>
      {estado && !estado.ok && <Aviso tom="alerta">{estado.erro}</Aviso>}
    </div>
  );
}
