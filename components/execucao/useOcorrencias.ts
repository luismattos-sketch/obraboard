"use client";

import { useContext, useState } from "react";
import type { Resultado } from "@/lib/db/resultado";
import type { DadosOcorrencia } from "@/lib/db/validacao";
import type { Ocorrencia } from "@/lib/dominio/efetivoHH";
import type { OcorrenciaNaTela } from "./OcorrenciasEfetivo";
import { ContextoSalvamento } from "./rastreioSalvamento";
import { decidirRepeticao } from "./repeticao";

export type AcoesOcorrencias = {
  criar: (responsavelId: string | null, d: DadosOcorrencia) => Promise<Resultado<unknown>>;
  remover: (id: string) => Promise<Resultado<unknown>>;
  /** Pede ao servidor os dados novos depois de gravar (router.refresh). */
  atualizar?: () => void;
};

const online = () => typeof navigator === "undefined" || navigator.onLine !== false;

/**
 * Lista de ocorrências na tela: as do servidor + as ainda não confirmadas ("salvando…"), sem as que estão
 * sendo removidas. Falha de rede repete sempre (mesmo intervalo do restante do lançamento) e entra no aviso
 * de "não salvo" do topo; erro de negócio desfaz a ação na tela e mostra a mensagem.
 */
export function useOcorrencias(servidor: Ocorrencia[], acoes: AcoesOcorrencias) {
  const [novas, setNovas] = useState<Map<string, OcorrenciaNaTela>>(new Map());
  const [removendo, setRemovendo] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const registrar = useContext(ContextoSalvamento);

  const idsServidor = new Set(servidor.map((o) => o.id));
  const lista: OcorrenciaNaTela[] = [
    ...servidor.filter((o) => !removendo.has(o.id)),
    ...[...novas.values()].filter((o) => !idsServidor.has(o.id)),
  ];

  async function executar(chave: string, fn: () => Promise<Resultado<unknown>>): Promise<Resultado<unknown>> {
    let falhas = 0;
    registrar?.(chave, "salvando");
    for (;;) {
      try {
        const r = await fn();
        registrar?.(chave, null);
        return r;
      } catch {
        const d = decidirRepeticao(falhas, online());
        falhas = d.falhas;
        await new Promise<void>((pronto) => {
          const t = setTimeout(pronto, d.emMs);
          registrar?.(chave, "falhou", () => {
            clearTimeout(t);
            pronto();
          });
        });
        registrar?.(chave, "salvando");
      }
    }
  }

  async function criar(responsavelId: string | null, d: DadosOcorrencia) {
    setErro(null);
    const naTela: OcorrenciaNaTela = { ...d, responsavel_id: responsavelId, created_at: new Date().toISOString(), pendente: true };
    setNovas((m) => new Map(m).set(d.id, naTela));
    const r = await executar(`ocorrencia-${d.id}`, () => acoes.criar(responsavelId, d));
    if (r.ok) {
      setNovas((m) => new Map(m).set(d.id, { ...naTela, pendente: false }));
      acoes.atualizar?.();
    } else {
      setNovas((m) => {
        const x = new Map(m);
        x.delete(d.id);
        return x;
      });
      setErro(r.erro);
    }
  }

  async function remover(id: string) {
    setErro(null);
    setRemovendo((s) => new Set(s).add(id));
    const r = await executar(`ocorrencia-rem-${id}`, () => acoes.remover(id));
    if (r.ok) {
      setNovas((m) => {
        const x = new Map(m);
        x.delete(id);
        return x;
      });
      acoes.atualizar?.();
    } else {
      setRemovendo((s) => {
        const x = new Set(s);
        x.delete(id);
        return x;
      });
      setErro(r.erro);
    }
  }

  return { lista, criar, remover, erro };
}
