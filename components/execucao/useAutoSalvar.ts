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
};

const online = () => typeof navigator === "undefined" || navigator.onLine !== false;

/**
 * Salva automaticamente quando `deps` mudam (debounce). Falha de rede (a função lançou) repete a
 * cada 5 s mantendo o valor, até 5 vezes (sem conexão, repete até voltar); erro de negócio
 * (ok:false) mostra a mensagem e não repete. `deps` deve estar no formato gravado no banco
 * (ver lib/dominio/assinatura.ts) para o Sincronizar reconhecer o próprio salvamento.
 */
export function useAutoSalvar(
  salvar: () => Promise<Resultado<unknown>>,
  deps: unknown[],
  atrasoMs = 800,
): EstadoSalvar {
  const [estado, setEstado] = useState<EstadoSalvar>({ estado: "ocioso" });
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
  const chave = JSON.stringify(deps);
  const ultima = useRef(chave);
  // Há um salvamento agendado (ou uma repetição de rede) que pode ser antecipado.
  const antecipar = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (chave === ultima.current) return; // montagem inicial: nada a salvar
    ultima.current = chave;
    let cancelado = false;
    let timer: ReturnType<typeof setTimeout>;
    let falhas = 0;

    const tentar = async () => {
      antecipar.current = null;
      setEstado({ estado: "salvando" });
      try {
        const r = await salvarRef.current();
        if (cancelado) return;
        setEstado(r.ok ? { estado: "salvo" } : { estado: "erro", mensagem: r.erro });
        if (r.ok) {
          sincroniaRef.current?.salvo(chave);
          sincroniaRef.current?.sujo(false);
        }
        registrarRef.current?.(id, false);
      } catch {
        if (cancelado) return;
        const d = decidirRepeticao(falhas, online());
        if (d.repetir) {
          falhas = d.falhas;
          setEstado({ estado: "erro" });
          agendar(d.emMs);
        } else {
          // Desistiu: libera o "Enviar" (nada mais em andamento), mas a edição continua pendente.
          setEstado({ estado: "erro", mensagem: d.mensagem });
          registrarRef.current?.(id, false);
        }
      }
    };
    const agendar = (ms: number) => {
      timer = setTimeout(tentar, ms);
      antecipar.current = () => {
        clearTimeout(timer);
        void tentar();
      };
    };
    registrarRef.current?.(id, true);
    sincroniaRef.current?.sujo(true);
    agendar(atrasoMs);
    return () => {
      cancelado = true;
      clearTimeout(timer);
      antecipar.current = null;
      registrarRef.current?.(id, false);
    };
  }, [chave, atrasoMs, id]);

  // Desmontou (ex.: remontagem com dados novos): não há mais edição pendente deste bloco.
  useEffect(() => {
    const ref = sincroniaRef;
    return () => ref.current?.sujo(false);
  }, []);

  // Ao sair da aba/página, salva já o que estiver pendente (o debounce não pode perder dados);
  // ao voltar a conexão, repete na hora.
  useEffect(() => {
    const aoEsconder = () => {
      if (document.visibilityState === "hidden") antecipar.current?.();
    };
    const aoSair = () => antecipar.current?.();
    document.addEventListener("visibilitychange", aoEsconder);
    window.addEventListener("pagehide", aoSair);
    window.addEventListener("online", aoSair);
    return () => {
      document.removeEventListener("visibilitychange", aoEsconder);
      window.removeEventListener("pagehide", aoSair);
      window.removeEventListener("online", aoSair);
    };
  }, []);

  return estado;
}
