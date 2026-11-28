"use client";

import { useState } from "react";
import { classesBotao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";

const campo =
  "min-h-12 w-full rounded-botao border border-borda bg-superficie px-3 text-base text-texto focus-visible:outline-2 focus-visible:outline-operacional";

type Tipo = "semana" | "mes" | "obra";

/** Item 4.4: escolha do período e download do Relatório da Obra em PDF. */
export function RelatorioObra({ obraId, hoje }: { obraId: string; hoje: string }) {
  const [tipo, setTipo] = useState<Tipo>("semana");
  const [dia, setDia] = useState(hoje);
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const valor = tipo === "semana" ? dia : tipo === "mes" ? mes : "";
  const pronto = tipo === "obra" || !!valor;
  const href = `/api/relatorio-obra?obra=${encodeURIComponent(obraId)}&tipo=${tipo}${valor ? `&valor=${encodeURIComponent(valor)}` : ""}`;

  return (
    <Cartao id="relatorio-obra" className="flex scroll-mt-4 flex-col gap-3">
      <h2 className="text-lg font-semibold text-primaria">Relatório da Obra (PDF)</h2>
      <p className="text-sm text-texto-suave">
        Linha do tempo, HH, paradas (impactos externos × internos), serviços extras para medição com a ciência do cliente e fotos. Só turnos
        fechados.
      </p>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Período</legend>
        {(
          [
            ["semana", "Semana"],
            ["mes", "Mês"],
            ["obra", "Obra inteira"],
          ] as const
        ).map(([v, rotulo]) => (
          <label
            key={v}
            className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-botao border px-3 ${tipo === v ? "border-operacional bg-primaria-clara font-semibold" : "border-borda"}`}
          >
            <input type="radio" name="tipo" value={v} checked={tipo === v} onChange={() => setTipo(v)} />
            {rotulo}
          </label>
        ))}
      </fieldset>
      {tipo === "semana" && (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Qualquer dia da semana
          <input type="date" className={campo} value={dia} max={hoje} onChange={(e) => setDia(e.target.value)} />
        </label>
      )}
      {tipo === "mes" && (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Mês
          <input type="month" className={campo} value={mes} max={hoje.slice(0, 7)} onChange={(e) => setMes(e.target.value)} />
        </label>
      )}
      <a
        href={pronto ? href : undefined}
        aria-disabled={!pronto}
        className={`${classesBotao("primario")} ${pronto ? "" : "pointer-events-none opacity-50"}`}
      >
        Baixar relatório
      </a>
    </Cartao>
  );
}
