"use client";

import type { ReactNode } from "react";

type Props = {
  titulo: ReactNode;
  id?: string;
  /** Não controlado: começa aberto. */
  abertoInicial?: boolean;
  /** Controlado: o pai decide (ex.: o "ir" da causa abre a seção). */
  aberto?: boolean;
  aoMudar?: (aberto: boolean) => void;
  children: ReactNode;
};

/** Seção que abre e fecha com um toque. Volta fechada a cada visita (nada guardado no navegador). */
export function Recolhivel({ titulo, id, abertoInicial, aberto, aoMudar, children }: Props) {
  const controlado = aberto !== undefined;
  return (
    <details
      id={id}
      className="rounded-cartao border border-borda bg-superficie p-4"
      {...(controlado ? { open: aberto } : abertoInicial ? { open: true } : {})}
      onToggle={(e) => {
        const agora = e.currentTarget.open;
        if (controlado && agora !== aberto) aoMudar?.(agora);
        else if (!controlado) aoMudar?.(agora);
      }}
    >
      <summary className="cursor-pointer text-lg font-semibold text-texto">{titulo}</summary>
      <div className="mt-3 flex min-w-0 flex-col gap-3">{children}</div>
    </details>
  );
}
