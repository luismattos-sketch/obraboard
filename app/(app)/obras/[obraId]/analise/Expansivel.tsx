import type { ReactNode } from "react";

/** Linha que abre detalhes (acordeão nativo) com seta indicando que é tocável. */
export function Expansivel({ resumo, children }: { resumo: ReactNode; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded hover:bg-primaria-clara [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="shrink-0 text-texto-suave transition-transform group-open:rotate-90">
          ›
        </span>
        <span className="min-w-0 flex-1">{resumo}</span>
      </summary>
      {children}
    </details>
  );
}
