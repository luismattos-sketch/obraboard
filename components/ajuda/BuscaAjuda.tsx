"use client";

import Link from "next/link";
import { useState } from "react";
import { Campo } from "@/components/ui/Campo";
import { buscarAjuda } from "@/lib/ajuda/busca";

/** Busca no manual, só na memória da página (nada guardado no navegador). */
export function BuscaAjuda() {
  const [termo, setTermo] = useState("");
  const resultados = buscarAjuda(termo);
  const buscando = termo.trim().length >= 2;
  return (
    <div role="search" className="flex flex-col gap-2">
      <Campo rotulo="Buscar na ajuda" type="search" value={termo} onChange={(e) => setTermo(e.target.value)}
        placeholder="Ex.: liberar, parada, RDO" />
      {buscando && (
        <div aria-live="polite">
          {resultados.length === 0 ? (
            <p className="text-sm text-texto-suave">
              Nada encontrado. Veja as <Link href="/ajuda/duvidas" className="text-operacional underline">Dúvidas comuns</Link>.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-borda rounded-cartao border border-borda bg-superficie">
              {resultados.map((r) => (
                <li key={r.href}>
                  <Link href={r.href} className="flex flex-col px-4 py-2 hover:bg-primaria-clara">
                    <span className="font-medium text-primaria">{r.passo}</span>
                    <span className="text-sm text-texto-suave">{r.capitulo}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
