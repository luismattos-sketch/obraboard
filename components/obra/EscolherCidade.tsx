"use client";

import { useEffect, useRef, useState } from "react";
import type { Cidade } from "@/lib/clima/tipos";
import { buscarCidadesAcao } from "@/app/(app)/obras/acoesCidade";

const campo =
  "min-h-12 w-full rounded-botao border border-borda bg-superficie px-3 text-base text-texto focus-visible:outline-2 focus-visible:outline-operacional";

/** Busca de cidade (Open-Meteo) para o clima automático. Com `nomeCampo`, vai no formulário como campos ocultos. */
export function EscolherCidade({
  inicial = null, onEscolher, nomeCampo, erro,
}: { inicial?: Cidade | null; onEscolher?: (c: Cidade) => void; nomeCampo?: string; erro?: string }) {
  const [escolhida, setEscolhida] = useState<Cidade | null>(inicial);
  const [termo, setTermo] = useState(inicial?.nome ?? "");
  const [lista, setLista] = useState<Cidade[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const pedido = useRef(0);

  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (espera.current) clearTimeout(espera.current);
  }, []);

  function digitar(valor: string) {
    setTermo(valor);
    if (escolhida && valor.trim() !== escolhida.nome) setEscolhida(null);
    if (espera.current) clearTimeout(espera.current);
    const t = valor.trim();
    const n = ++pedido.current;
    if (t.length < 2) {
      setLista(null);
      setBuscando(false);
      return;
    }
    espera.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await buscarCidadesAcao(t);
        if (n === pedido.current) setLista(r);
      } catch {
        if (n === pedido.current) setLista([]);
      } finally {
        if (n === pedido.current) setBuscando(false);
      }
    }, 400);
  }

  function escolher(c: Cidade) {
    ++pedido.current;
    setBuscando(false);
    setEscolhida(c);
    setTermo(c.nome);
    setLista(null);
    onEscolher?.(c);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">
        Cidade (para o clima)
        <input
          type="text"
          className={campo}
          value={termo}
          placeholder="Digite o nome da cidade"
          autoComplete="off"
          aria-invalid={erro ? true : undefined}
          onChange={(e) => digitar(e.target.value)}
        />
      </label>
      {buscando && <p className="text-sm text-texto-suave">Buscando…</p>}
      {lista && !buscando && lista.length === 0 && <p className="text-sm text-texto-suave">Nenhuma cidade encontrada</p>}
      {lista && lista.length > 0 && (
        <ul className="flex flex-col gap-1">
          {lista.map((c) => (
            <li key={`${c.nome}${c.latitude}${c.longitude}`}>
              <button
                type="button"
                className="min-h-12 w-full rounded-botao border border-borda bg-superficie px-3 text-left hover:bg-primaria-clara"
                onClick={() => escolher(c)}
              >
                {c.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
      {erro && <p className="text-sm text-perigo">{erro}</p>}
      {nomeCampo && escolhida && (
        <>
          <input type="hidden" name={`${nomeCampo}_nome`} value={escolhida.nome} />
          <input type="hidden" name={`${nomeCampo}_lat`} value={escolhida.latitude} />
          <input type="hidden" name={`${nomeCampo}_lon`} value={escolhida.longitude} />
        </>
      )}
    </div>
  );
}
