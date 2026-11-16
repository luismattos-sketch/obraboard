"use client";

import { createContext, Fragment, useContext, useMemo, useState, type ReactNode } from "react";

/** Sinais do auto-salvamento para o Sincronizar mais próximo. */
export type Sincronia = {
  /** Há edição local ainda não gravada (salvando, repetindo ou com erro). Nova edição apaga a nota. */
  sujo: (v: boolean) => void;
  /** Gravou com sucesso este valor (mesmo formato de `servidor`). */
  salvo: (chave: string) => void;
  /**
   * Conflito: descarta a edição local, remonta o bloco com os dados do servidor e pede dados novos
   * à página. `nota` (o que a pessoa tinha digitado) fica visível até a próxima edição.
   */
  recarregar: (nota: string) => void;
  nota: string | null;
};
export const ContextoSincronia = createContext<Sincronia | null>(null);

/** Pede dados novos ao servidor (router.refresh), fornecido pela página (ver ProvedorSalvamento). */
export const ContextoRecarregarPagina = createContext<(() => void) | null>(null);

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
  const [nota, setNota] = useState<string | null>(null);
  const recarregarPagina = useContext(ContextoRecarregarPagina);

  if (atual !== vista && !sujo) {
    setVista(atual);
    if (atual !== salva) {
      setSalva(atual);
      setGeracao((g) => g + 1);
    }
  }

  const sinais = useMemo<Omit<Sincronia, "nota">>(
    () => ({
      sujo: (v) => {
        setSujo(v);
        if (v) setNota(null);
      },
      salvo: setSalva,
      recarregar: (n) => {
        setNota(n);
        setSujo(false);
        // Remonta já com as props atuais e de novo quando o refresh trouxer os dados do servidor.
        setSalva("");
        setGeracao((g) => g + 1);
        recarregarPagina?.();
      },
    }),
    [recarregarPagina],
  );
  const valor = useMemo<Sincronia>(() => ({ ...sinais, nota }), [sinais, nota]);
  return (
    <ContextoSincronia.Provider value={valor}>
      <Fragment key={geracao}>{children}</Fragment>
    </ContextoSincronia.Provider>
  );
}
