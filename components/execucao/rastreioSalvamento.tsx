"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useRef, useState, type ReactNode } from "react";
import { ContextoRecarregarPagina } from "./Sincronizar";

/** Registro de "quem está salvando" para bloquear o envio do turno enquanto houver gravação pendente. */
export type Registrar = (id: string, ocupado: boolean) => void;
export const ContextoSalvamento = createContext<Registrar | null>(null);

export function useRastreioSalvamento() {
  const ocupados = useRef(new Set<string>());
  const [ocupado, setOcupado] = useState(false);
  const registrar = useCallback<Registrar>((id, v) => {
    if (v) ocupados.current.add(id);
    else ocupados.current.delete(id);
    setOcupado(ocupados.current.size > 0);
  }, []);
  return { ocupado, registrar };
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
