"use client";

import { classesBotao } from "@/components/ui/Botao";
import { horaCurta } from "@/lib/dominio/efetivoHH";
import { horaAgoraSaoPaulo } from "@/lib/dominio/entrada";

/** "Iniciar turno": grava a hora do toque da equipe; o horário real do turno sai do primeiro início. */
export function BotaoIniciar({
  iniciouEm,
  marcar,
  desfazer,
  salvando,
}: {
  iniciouEm: string | null;
  marcar: (hora: string) => void;
  desfazer: () => void;
  salvando?: boolean;
}) {
  if (iniciouEm) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-cartao border border-sucesso p-3">
        <p className="font-semibold text-texto">
          {`✓ Você iniciou às ${horaCurta(iniciouEm)}`}
          {salvando && <span className="font-normal text-texto-suave"> · salvando…</span>}
        </p>
        <button type="button" className="min-h-12 px-2 text-texto-suave underline" onClick={desfazer}>Desfazer</button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className={`${classesBotao("destaque")} w-full`}
        disabled={salvando}
        onClick={() => marcar(horaAgoraSaoPaulo())}
      >
        {salvando ? "Salvando…" : "▶ Iniciar turno"}
      </button>
      <p className="text-sm text-texto-suave">Toque quando sua equipe começar. A hora fica registrada para o planejador.</p>
    </div>
  );
}
