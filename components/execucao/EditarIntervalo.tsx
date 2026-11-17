"use client";

import { useState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import type { Resultado } from "@/lib/db/resultado";
import type { Janela } from "@/lib/dominio/efetivoHH";

const campo =
  "min-h-12 w-full rounded-botao border border-borda bg-superficie px-3 text-base text-texto focus-visible:outline-2 focus-visible:outline-operacional";

/** Intervalo de refeição (descontado do HH). Vazio nos dois campos = sem intervalo. Salva no botão. */
export function EditarIntervalo({
  rotulo,
  ajuda,
  inicial,
  salvar,
}: {
  rotulo: string;
  ajuda?: string;
  inicial: Janela | null;
  salvar: (j: Janela | null) => Promise<Resultado<unknown>>;
}) {
  const [inicio, setInicio] = useState(inicial?.inicio.slice(0, 5) ?? "");
  const [fim, setFim] = useState(inicial?.fim.slice(0, 5) ?? "");
  const [msg, setMsg] = useState<{ tom: "sucesso" | "perigo"; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function enviar() {
    setSalvando(true);
    setMsg(null);
    try {
      const r = await salvar(inicio || fim ? { inicio, fim } : null);
      setMsg(r.ok ? { tom: "sucesso", texto: "Intervalo salvo ✓" } : { tom: "perigo", texto: r.erro });
    } catch {
      setMsg({ tom: "perigo", texto: "Sem conexão — tente de novo." });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="font-semibold text-texto">{rotulo}</p>
      {ajuda && <p className="text-sm text-texto-suave">{ajuda}</p>}
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-medium">
          Início
          <input type="time" className={campo} value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </label>
        <label className="text-sm font-medium">
          Fim
          <input type="time" className={campo} value={fim} onChange={(e) => setFim(e.target.value)} />
        </label>
      </div>
      <button
        type="button"
        disabled={salvando}
        className="min-h-12 rounded-botao border border-operacional bg-superficie font-semibold text-primaria hover:bg-primaria-clara disabled:opacity-70"
        onClick={enviar}
      >
        {salvando ? "Salvando…" : "Salvar intervalo"}
      </button>
      {msg && <Aviso tom={msg.tom}>{msg.texto}</Aviso>}
    </div>
  );
}
