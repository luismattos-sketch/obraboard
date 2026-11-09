"use client";

import { useContext, useEffect, useId, useRef, useState } from "react";
import type { Resultado } from "@/lib/db/resultado";
import { ContextoSalvamento } from "./rastreioSalvamento";

export type EstadoSalvar = {
  estado: "ocioso" | "salvando" | "salvo" | "erro";
  /** Presente só em erro de negócio. Em `erro` sem mensagem = falha de rede (repete a cada 5 s). */
  mensagem?: string;
};

const INTERVALO_REPETIR_MS = 5000;

/**
 * Salva automaticamente quando `deps` mudam (debounce). Falha de rede (a função lançou) repete a
 * cada 5 s mantendo o valor; erro de negócio (ok:false) mostra a mensagem e não repete.
 */
export function useAutoSalvar(
  salvar: () => Promise<Resultado<unknown>>,
  deps: unknown[],
  atrasoMs = 800,
): EstadoSalvar {
  const [estado, setEstado] = useState<EstadoSalvar>({ estado: "ocioso" });
  const salvarRef = useRef(salvar);
  useEffect(() => {
    salvarRef.current = salvar;
  });
  const registrar = useContext(ContextoSalvamento);
  const id = useId();
  const registrarRef = useRef(registrar);
  useEffect(() => {
    registrarRef.current = registrar;
  });
  const chave = JSON.stringify(deps);
  const ultima = useRef(chave);
  // Há um salvamento agendado (ou uma repetição de rede) que pode ser antecipado.
  const antecipar = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (chave === ultima.current) return; // montagem inicial: nada a salvar
    ultima.current = chave;
    let cancelado = false;
    let timer: ReturnType<typeof setTimeout>;

    const tentar = async () => {
      antecipar.current = null;
      setEstado({ estado: "salvando" });
      try {
        const r = await salvarRef.current();
        if (cancelado) return;
        setEstado(r.ok ? { estado: "salvo" } : { estado: "erro", mensagem: r.erro });
        registrarRef.current?.(id, false);
      } catch {
        if (cancelado) return;
        setEstado({ estado: "erro" });
        agendar(INTERVALO_REPETIR_MS);
      }
    };
    const agendar = (ms: number) => {
      timer = setTimeout(tentar, ms);
      antecipar.current = () => {
        clearTimeout(timer);
        void tentar();
      };
    };
    registrarRef.current?.(id, true);
    agendar(atrasoMs);
    return () => {
      cancelado = true;
      clearTimeout(timer);
      antecipar.current = null;
      registrarRef.current?.(id, false);
    };
  }, [chave, atrasoMs, id]);

  // Ao sair da aba/página, salva já o que estiver pendente (o debounce não pode perder dados).
  useEffect(() => {
    const aoEsconder = () => {
      if (document.visibilityState === "hidden") antecipar.current?.();
    };
    const aoSair = () => antecipar.current?.();
    document.addEventListener("visibilitychange", aoEsconder);
    window.addEventListener("pagehide", aoSair);
    return () => {
      document.removeEventListener("visibilitychange", aoEsconder);
      window.removeEventListener("pagehide", aoSair);
    };
  }, []);

  return estado;
}
