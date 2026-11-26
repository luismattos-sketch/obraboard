"use client";

import { useState } from "react";
import { EscolherCidade } from "@/components/obra/EscolherCidade";
import { Aviso } from "@/components/ui/Aviso";
import { Cartao } from "@/components/ui/Cartao";
import type { Cidade } from "@/lib/clima/tipos";
import { salvarCidadeObraAcao } from "../acoesCidade";

/** Cidade usada para o clima automático do RDO. Salva ao escolher na lista. */
export function CidadeObra({ obraId, inicial }: { obraId: string; inicial: Cidade | null }) {
  const [msg, setMsg] = useState<{ tom: "sucesso" | "perigo"; texto: string } | null>(null);

  async function salvar(c: Cidade) {
    setMsg(null);
    try {
      const r = await salvarCidadeObraAcao(obraId, c);
      setMsg(r.ok ? { tom: "sucesso", texto: "Cidade salva ✓" } : { tom: "perigo", texto: r.erro });
    } catch {
      setMsg({ tom: "perigo", texto: "Sem conexão — tente de novo." });
    }
  }

  return (
    <Cartao className="flex flex-col gap-3" id="cidade">
      <div>
        <h2 className="text-lg font-semibold text-primaria">Cidade da obra</h2>
        <p className="text-sm text-texto-suave">Usada para registrar o clima de cada turno no RDO.</p>
      </div>
      <EscolherCidade inicial={inicial} onEscolher={salvar} />
      {msg && <Aviso tom={msg.tom}>{msg.texto}</Aviso>}
    </Cartao>
  );
}
