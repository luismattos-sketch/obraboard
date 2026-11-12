"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Pede ao servidor os dados novos do quadro a cada `ms` (só com a aba visível). Nada é guardado no navegador. */
export function AtualizarPeriodicamente({ ms = 30_000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, ms);
    return () => window.clearInterval(id);
  }, [router, ms]);
  return null;
}
