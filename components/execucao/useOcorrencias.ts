"use client";

import { useContext, useState } from "react";
import type { Resultado } from "@/lib/db/resultado";
import type { DadosOcorrencia } from "@/lib/db/validacao";
import type { Ocorrencia } from "@/lib/dominio/efetivoHH";
import type { OcorrenciaNaTela } from "./OcorrenciasEfetivo";
import type { EstadoFoto } from "./PainelParadas";
import { ContextoSalvamento, type Registrar } from "./rastreioSalvamento";
import { reduzirFoto } from "./reduzirFoto";
import { decidirRepeticao } from "./repeticao";

export type AcoesOcorrencias = {
  criar: (responsavelId: string | null, d: DadosOcorrencia) => Promise<Resultado<unknown>>;
  remover: (id: string) => Promise<Resultado<unknown>>;
  /** Parada: grava o fim ("Voltamos a trabalhar"). */
  encerrar?: (id: string, horaFim: string) => Promise<Resultado<unknown>>;
  /** Parada: foto (campo "foto", JPEG já reduzido). */
  enviarFoto?: (id: string, form: FormData) => Promise<Resultado<unknown>>;
  /** Pede ao servidor os dados novos depois de gravar (router.refresh). */
  atualizar?: () => void;
};

const online = () => typeof navigator === "undefined" || navigator.onLine !== false;

/**
 * Lista de ocorrências na tela: as do servidor + as ainda não confirmadas ("salvando…"), sem as que estão
 * sendo removidas. Falha de rede repete sempre (mesmo intervalo do restante do lançamento) e entra no aviso
 * de "não salvo" do topo; erro de negócio desfaz a ação na tela e mostra a mensagem.
 */
export function useOcorrencias(servidor: Ocorrencia[], acoes: AcoesOcorrencias, registrarFora?: Registrar | null) {
  const [novas, setNovas] = useState<Map<string, OcorrenciaNaTela>>(new Map());
  const [removendo, setRemovendo] = useState<Set<string>>(new Set());
  /** Fim gravado na tela antes da confirmação ("Voltamos a trabalhar"). */
  const [fins, setFins] = useState<Map<string, { hora: string; pendente: boolean }>>(new Map());
  const [estadoFoto, setEstadoFoto] = useState<Record<string, EstadoFoto>>({});
  const [fotosPendentes, setFotosPendentes] = useState<Map<string, File>>(new Map());
  const [erro, setErro] = useState<string | null>(null);
  const doContexto = useContext(ContextoSalvamento);
  const registrar = registrarFora ?? doContexto;

  const idsServidor = new Set(servidor.map((o) => o.id));
  const comFim = (o: OcorrenciaNaTela): OcorrenciaNaTela => {
    const f = fins.get(o.id);
    if (!f || o.hora_fim) return o;
    return { ...o, hora_fim: f.hora, pendente: o.pendente || f.pendente };
  };
  const lista: OcorrenciaNaTela[] = [
    ...servidor.filter((o) => !removendo.has(o.id)),
    ...[...novas.values()].filter((o) => !idsServidor.has(o.id)),
  ].map(comFim);

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

  async function criar(responsavelId: string | null, d: DadosOcorrencia, foto: File | null = null) {
    setErro(null);
    const naTela: OcorrenciaNaTela = { ...d, responsavel_id: responsavelId, created_at: new Date().toISOString(), pendente: true };
    setNovas((m) => new Map(m).set(d.id, naTela));
    const r = await executar(`ocorrencia-${d.id}`, () => acoes.criar(responsavelId, d));
    if (r.ok) {
      setNovas((m) => new Map(m).set(d.id, { ...naTela, pendente: false }));
      // A foto só sobe depois de a parada estar gravada: o aviso nunca espera por ela.
      if (foto) await anexarFoto(d.id, foto);
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

  async function encerrar(id: string, hora: string) {
    if (!acoes.encerrar) return;
    setErro(null);
    setFins((m) => new Map(m).set(id, { hora, pendente: true }));
    const r = await executar(`parada-fim-${id}`, () => acoes.encerrar!(id, hora));
    if (r.ok) {
      setFins((m) => new Map(m).set(id, { hora, pendente: false }));
      acoes.atualizar?.();
    } else {
      setFins((m) => {
        const x = new Map(m);
        x.delete(id);
        return x;
      });
      setErro(r.erro);
    }
  }

  async function anexarFoto(id: string, foto: File) {
    if (!acoes.enviarFoto) return;
    setFotosPendentes((m) => new Map(m).set(id, foto));
    setEstadoFoto((e) => ({ ...e, [id]: "enviando" }));
    let blob: Blob;
    try {
      blob = await reduzirFoto(foto);
    } catch {
      setEstadoFoto((e) => ({ ...e, [id]: "falhou" }));
      setErro("Não foi possível preparar a foto. Tente outra.");
      return;
    }
    const form = new FormData();
    form.set("foto", new File([blob], "foto.jpg", { type: "image/jpeg" }));
    const r = await executar(`parada-foto-${id}`, () => acoes.enviarFoto!(id, form));
    if (r.ok) {
      setEstadoFoto((e) => {
        const x = { ...e };
        delete x[id];
        return x;
      });
      setFotosPendentes((m) => {
        const x = new Map(m);
        x.delete(id);
        return x;
      });
      acoes.atualizar?.();
    } else {
      setEstadoFoto((e) => ({ ...e, [id]: "falhou" }));
      setErro(r.erro);
    }
  }

  /** "Foto não enviada · tentar de novo": reenvia a mesma foto (ainda na memória da página). */
  function tentarFoto(id: string) {
    const f = fotosPendentes.get(id);
    if (f) void anexarFoto(id, f);
  }

  return { lista, criar, remover, encerrar, anexarFoto, tentarFoto, estadoFoto, erro };
}
