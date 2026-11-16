"use client";

import { useContext, useEffect, useId, useRef, useState } from "react";
import type { Resultado } from "@/lib/db/resultado";
import { decidirRepeticao } from "./repeticao";
import { ContextoSalvamento } from "./rastreioSalvamento";
import { ContextoSincronia } from "./Sincronizar";

export type EstadoSalvar = {
  estado: "ocioso" | "salvando" | "salvo" | "erro";
  /** Presente em erro de negócio ou após desistir. Em `erro` sem mensagem = sem conexão (repetindo). */
  mensagem?: string;
  /** Erro de negócio por conflito: o valor mudou em outra tela (ver Resultado.conflito). */
  conflito?: { atual?: unknown };
};

const online = () => typeof navigator === "undefined" || navigator.onLine !== false;

/**
 * Salva automaticamente quando `deps` mudam (debounce). Falha de rede (a função lançou) repete
 * sempre, com intervalo crescente (ver repeticao.ts), mantendo o valor; erro de negócio
 * (ok:false) mostra a mensagem e não repete. `deps` deve estar no formato gravado no banco
 * (ver lib/dominio/assinatura.ts) para o Sincronizar reconhecer o próprio salvamento.
 */
export function useAutoSalvar(
  salvar: () => Promise<Resultado<unknown>>,
  deps: unknown[],
  atrasoMs = 800,
): EstadoSalvar & { tentar: () => void } {
  const chave = JSON.stringify(deps);
  // O estado vale para a edição `de`; outra edição na tela já é "salvando" na hora (sem esperar o
  // debounce), para o "Salvo ✓" antigo nunca aparecer junto de um valor ainda não gravado.
  const [estado, setEstado] = useState<EstadoSalvar & { de: string }>({ estado: "ocioso", de: chave });
  const salvarRef = useRef(salvar);
  useEffect(() => {
    salvarRef.current = salvar;
  });
  const registrar = useContext(ContextoSalvamento);
  const sincronia = useContext(ContextoSincronia);
  const id = useId();
  const registrarRef = useRef(registrar);
  const sincroniaRef = useRef(sincronia);
  useEffect(() => {
    registrarRef.current = registrar;
    sincroniaRef.current = sincronia;
  });
  const ultima = useRef(chave);
  // Há um salvamento agendado (ou uma repetição de rede) que pode ser antecipado.
  const antecipar = useRef<(() => void) | null>(null);
  const [tentarJa] = useState(() => () => antecipar.current?.());

  useEffect(() => {
    if (chave === ultima.current) return; // montagem inicial: nada a salvar
    ultima.current = chave;
    let cancelado = false;
    let timer: ReturnType<typeof setTimeout>;
    let falhas = 0;

    const tentar = async () => {
      antecipar.current = null;
      setEstado({ estado: "salvando", de: chave });
      try {
        const r = await salvarRef.current();
        if (cancelado) return;
        setEstado(r.ok ? { estado: "salvo", de: chave } : { estado: "erro", mensagem: r.erro, conflito: r.conflito, de: chave });
        if (r.ok) {
          sincroniaRef.current?.salvo(chave);
          sincroniaRef.current?.sujo(false);
        }
        registrarRef.current?.(id, null);
      } catch {
        if (cancelado) return;
        const d = decidirRepeticao(falhas, online());
        falhas = d.falhas;
        setEstado({ estado: "erro", de: chave });
        agendar(d.emMs);
        registrarRef.current?.(id, "falhou", tentarJa);
      }
    };
    const agendar = (ms: number) => {
      timer = setTimeout(tentar, ms);
      antecipar.current = () => {
        clearTimeout(timer);
        void tentar();
      };
    };
    registrarRef.current?.(id, "salvando");
    sincroniaRef.current?.sujo(true);
    agendar(atrasoMs);
    return () => {
      cancelado = true;
      clearTimeout(timer);
      antecipar.current = null;
      registrarRef.current?.(id, null);
    };
  }, [chave, atrasoMs, id, tentarJa]);

  // Desmontou (ex.: remontagem com dados novos): não há mais edição pendente deste bloco.
  useEffect(() => {
    const ref = sincroniaRef;
    return () => ref.current?.sujo(false);
  }, []);

  // Ao sair ou voltar para a aba, e quando a conexão volta, tenta já o que estiver pendente.
  useEffect(() => {
    const aoMudarVisibilidade = () => antecipar.current?.();
    const aoSair = () => antecipar.current?.();
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    window.addEventListener("pagehide", aoSair);
    window.addEventListener("online", aoSair);
    return () => {
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      window.removeEventListener("pagehide", aoSair);
      window.removeEventListener("online", aoSair);
    };
  }, []);

  const { de, ...visivel } = estado;
  return { ...(de === chave ? visivel : { estado: "salvando" as const }), tentar: tentarJa };
}
