"use client";

import { useState } from "react";
import { horaCurta } from "@/lib/dominio/efetivoHH";
import { horaAgoraSaoPaulo } from "@/lib/dominio/entrada";

const botao =
  "inline-flex min-h-12 items-center justify-center rounded-botao border border-operacional bg-superficie px-3 font-semibold text-primaria hover:bg-primaria-clara";

/** "Terminei minha parte": marca a equipe como terminada (hora) no quadro e oferece avisar no WhatsApp. */
export function BotaoTerminei({
  terminouEm,
  abertasDaEquipe,
  marcar,
  desfazer,
  linkWhats,
  salvando,
}: {
  terminouEm: string | null;
  /** Paradas abertas da equipe: pergunta se encerra todas no mesmo horário. */
  abertasDaEquipe: number;
  marcar: (hora: string, encerrarAbertas: boolean) => void;
  desfazer: () => void;
  linkWhats: (hora: string) => string;
  salvando?: boolean;
}) {
  const [perguntando, setPerguntando] = useState<string | null>(null);

  if (terminouEm) {
    const h = horaCurta(terminouEm);
    return (
      <div className="flex flex-col gap-2 rounded-cartao border border-sucesso p-3">
        <p className="font-semibold text-texto">
          {`✓ Você avisou que terminou às ${h}`}
          {salvando && <span className="font-normal text-texto-suave"> · salvando…</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          <a className={botao} href={linkWhats(h)} target="_blank" rel="noopener noreferrer">Avisar no WhatsApp</a>
          <button type="button" className="min-h-12 px-2 text-texto-suave underline" onClick={desfazer}>Desfazer</button>
        </div>
      </div>
    );
  }
  if (perguntando) {
    return (
      <div className="flex flex-col gap-2 rounded-cartao border border-alerta p-3">
        <p className="text-texto">{`Há ${abertasDaEquipe === 1 ? "1 parada aberta" : `${abertasDaEquipe} paradas abertas`}. Encerrar às ${perguntando}?`}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={botao} onClick={() => { marcar(perguntando, true); setPerguntando(null); }}>Sim, encerrar</button>
          <button type="button" className={botao} onClick={() => { marcar(perguntando, false); setPerguntando(null); }}>Não</button>
        </div>
      </div>
    );
  }
  return (
    <button
      type="button"
      className={`${botao} w-full`}
      onClick={() => {
        const h = horaAgoraSaoPaulo();
        if (abertasDaEquipe > 0) setPerguntando(h);
        else marcar(h, false);
      }}
    >
      ✓ Terminei minha parte
    </button>
  );
}
