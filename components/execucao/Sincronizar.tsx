"use client";

import { createContext, Fragment, useMemo, useState, type ReactNode } from "react";

/** Sinais do auto-salvamento para o Sincronizar mais próximo. */
export type Sincronia = {
  /** Há edição local ainda não gravada (salvando, repetindo ou com erro). */
  sujo: (v: boolean) => void;
  /** Gravou com sucesso este valor (mesmo formato de `servidor`). */
  salvo: (chave: string) => void;
};
export const ContextoSincronia = createContext<Sincronia | null>(null);

/**
 * Remonta o conteúdo com os dados novos quando `servidor` muda por fora (revalidação/refresh),
 * para que um bloco antigo não sobrescreva o que outra pessoa gravou. Nunca remonta com edição
 * pendente, nem quando a mudança é o próprio salvamento (evita perder o foco ao digitar).
 * `servidor` deve ter o mesmo formato das deps do useAutoSalvar do conteúdo.
 */
export function Sincronizar({ servidor, children }: { servidor: unknown; children: ReactNode }) {
  const atual = JSON.stringify(servidor);
  const [vista, setVista] = useState(atual);
  const [salva, setSalva] = useState(atual);
  const [geracao, setGeracao] = useState(0);
  const [sujo, setSujo] = useState(false);

  if (atual !== vista && !sujo) {
    setVista(atual);
    if (atual !== salva) {
      setSalva(atual);
      setGeracao((g) => g + 1);
    }
  }

  const sinais = useMemo<Sincronia>(() => ({ sujo: setSujo, salvo: setSalva }), []);
  return (
    <ContextoSincronia.Provider value={sinais}>
      <Fragment key={geracao}>{children}</Fragment>
    </ContextoSincronia.Provider>
  );
}
