"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Ao voltar para a aba, pede dados novos ao servidor (o Sincronizar troca os blocos sem edição
 * pendente). Com salvamento em andamento não atualiza, para não competir com a gravação.
 */
export function useAtualizarAoVoltar(ocupado: boolean): void {
  const router = useRouter();
  const ocupadoRef = useRef(ocupado);
  useEffect(() => {
    ocupadoRef.current = ocupado;
  });
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === "visible" && !ocupadoRef.current) router.refresh();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [router]);
}
