"use client";

import { useActionState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import type { AtividadeResumida } from "@/lib/dominio/programacao";
import { CAUSAS } from "@/lib/dominio/tipos";
import { encerrarSemanaAcao, type EstadoSemana } from "./acoes";

export function FormEncerrar({ semanaId, naoCumpridas }: { semanaId: string; naoCumpridas: AtividadeResumida[] }) {
  const [estado, action, pendente] = useActionState<EstadoSemana, FormData>(encerrarSemanaAcao, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="semana_id" value={semanaId} />
      {naoCumpridas.length === 0 ? (
        <p className="text-texto-suave">Todas as atividades programadas foram cumpridas.</p>
      ) : (
        <>
          <p className="text-sm text-texto-suave">
            Confirme a causa de cada atividade não cumprida. A sugestão vem do último turno.
          </p>
          {naoCumpridas.map((a) => (
            <div key={a.id} className="flex flex-col gap-1">
              <label htmlFor={`causa-${a.id}`} className="text-sm font-medium text-texto">
                {a.descricao}
              </label>
              <select
                id={`causa-${a.id}`}
                name={`causa:${a.id}`}
                defaultValue={a.causa ?? a.causaSugerida ?? ""}
                required
                className="min-h-12 rounded-botao border border-borda bg-superficie px-3 text-base text-texto focus-visible:outline-2 focus-visible:outline-operacional"
              >
                <option value="" disabled>
                  Escolha a causa
                </option>
                {Object.entries(CAUSAS).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </>
      )}
      <Botao type="submit" variante="destaque" carregando={pendente}>
        Encerrar semana
      </Botao>
      {estado && !estado.ok && <Aviso tom="alerta">{estado.erro}</Aviso>}
    </form>
  );
}
