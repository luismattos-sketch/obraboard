"use client";

import { Botao } from "@/components/ui/Botao";

export function BotaoImprimir() {
  return (
    <Botao type="button" variante="secundario" className="print:hidden" onClick={() => window.print()}>
      Imprimir
    </Botao>
  );
}
