"use client";

import { useEffect, useRef, useState } from "react";
import type { Resultado } from "@/lib/db/resultado";

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
  const chave = JSON.stringify(deps);
  const ultima = useRef(chave);

  useEffect(() => {
    if (chave === ultima.current) return; // montagem inicial: nada a salvar
    ultima.current = chave;
    let cancelado = false;
    let timer: ReturnType<typeof setTimeout>;

    const tentar = async () => {
      setEstado({ estado: "salvando" });
      try {
        const r = await salvarRef.current();
        if (cancelado) return;
        setEstado(r.ok ? { estado: "salvo" } : { estado: "erro", mensagem: r.erro });
      } catch {
        if (cancelado) return;
        setEstado({ estado: "erro" });
        timer = setTimeout(tentar, INTERVALO_REPETIR_MS);
      }
    };
    timer = setTimeout(tentar, atrasoMs);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [chave, atrasoMs]);

  return estado;
}
