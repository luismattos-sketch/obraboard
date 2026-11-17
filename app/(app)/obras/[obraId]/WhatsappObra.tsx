"use client";

import { useState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Cartao } from "@/components/ui/Cartao";
import { salvarWhatsappObraAcao } from "./acoesIntervalo";

const campo =
  "min-h-12 w-full rounded-botao border border-borda bg-superficie px-3 text-base text-texto focus-visible:outline-2 focus-visible:outline-operacional";

/** Número que recebe os avisos de parada do campo (o botão do campo abre o WhatsApp com a mensagem pronta). */
export function WhatsappObra({ obraId, inicial }: { obraId: string; inicial: string | null }) {
  const [valor, setValor] = useState(inicial ? `+${inicial}` : "");
  const [msg, setMsg] = useState<{ tom: "sucesso" | "perigo"; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function enviar() {
    setSalvando(true);
    setMsg(null);
    try {
      const r = await salvarWhatsappObraAcao(obraId, valor);
      setMsg(r.ok ? { tom: "sucesso", texto: "Número salvo ✓" } : { tom: "perigo", texto: r.erro });
    } catch {
      setMsg({ tom: "perigo", texto: "Sem conexão — tente de novo." });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Cartao className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold text-primaria">WhatsApp do planejador</h2>
        <p className="text-sm text-texto-suave">Recebe os avisos de parada do campo. Deixe vazio para escolher o contato na hora.</p>
      </div>
      <label className="text-sm font-medium">
        Número
        <input type="tel" inputMode="tel" placeholder="(11) 98888-7777" className={campo} value={valor} onChange={(e) => setValor(e.target.value)} />
      </label>
      <button
        type="button"
        disabled={salvando}
        className="min-h-12 rounded-botao border border-operacional bg-superficie font-semibold text-primaria hover:bg-primaria-clara disabled:opacity-70"
        onClick={enviar}
      >
        {salvando ? "Salvando…" : "Salvar número"}
      </button>
      {msg && <Aviso tom={msg.tom}>{msg.texto}</Aviso>}
    </Cartao>
  );
}
