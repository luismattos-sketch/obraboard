"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ContextoRecarregarPagina } from "./Sincronizar";

/** "salvando": edição ainda não confirmada; "falhou": a rede falhou e o bloco está tentando de novo. */
export type EstadoPendente = "salvando" | "falhou";
/** `estado` null = nada pendente neste bloco. `antecipar`: tentar agora (usado pelo aviso do topo). */
export type Registrar = (id: string, estado: EstadoPendente | null, antecipar?: () => void) => void;
export const ContextoSalvamento = createContext<Registrar | null>(null);

type Pendente = { estado: EstadoPendente; antecipar?: () => void };

/**
 * Registro de "quem está salvando": trava o envio do turno, alimenta o aviso de não salvo no topo
 * e pede confirmação do navegador antes de sair/recarregar com algo pendente.
 */
export function useRastreioSalvamento() {
  const pendentes = useRef(new Map<string, Pendente>());
  const [ocupado, setOcupado] = useState(false);
  const [falhas, setFalhas] = useState(0);
  const registrar = useCallback<Registrar>((id, estado, antecipar) => {
    if (estado) pendentes.current.set(id, { estado, antecipar });
    else pendentes.current.delete(id);
    setOcupado(pendentes.current.size > 0);
    setFalhas([...pendentes.current.values()].filter((p) => p.estado === "falhou").length);
  }, []);
  const tentarTodos = useCallback(() => {
    for (const p of [...pendentes.current.values()]) if (p.estado === "falhou") p.antecipar?.();
  }, []);

  useEffect(() => {
    if (!ocupado) return;
    const antesDeSair = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", antesDeSair);
    return () => window.removeEventListener("beforeunload", antesDeSair);
  }, [ocupado]);

  return { ocupado, falhas, tentarTodos, registrar };
}

/** Também fornece aos blocos o "pedir dados novos" da página (conflito → Ver valor atual). */
export function ProvedorSalvamento({ registrar, children }: { registrar: Registrar; children: ReactNode }) {
  const router = useRouter();
  const recarregar = useCallback(() => router.refresh(), [router]);
  return (
    <ContextoRecarregarPagina.Provider value={recarregar}>
      <ContextoSalvamento.Provider value={registrar}>{children}</ContextoSalvamento.Provider>
    </ContextoRecarregarPagina.Provider>
  );
}
