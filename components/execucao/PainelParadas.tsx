"use client";

import { useState } from "react";
import { pessoas } from "@/lib/dominio/plural";
import { Aviso } from "@/components/ui/Aviso";
import type { DadosOcorrencia } from "@/lib/db/validacao";
import { descreverOcorrencia, horaCurta } from "@/lib/dominio/efetivoHH";
import { horaAgoraSaoPaulo } from "@/lib/dominio/entrada";
import type { ResponsavelRef } from "@/lib/dominio/quadro";
import type { Periodo } from "@/lib/dominio/tipos";
import { linkWhatsapp, mensagemParada, mensagemRetomada } from "@/lib/dominio/whatsapp";
import { FormParada, montarParada } from "./FormParada";
import type { OcorrenciaNaTela } from "./OcorrenciasEfetivo";

export type EstadoFoto = "enviando" | "falhou";

export type PropsPainelParadas = {
  /** null = "Ver tudo": todas as paradas abertas, só leitura. */
  responsavelId: string | null;
  /** Todas as ocorrências do turno (o painel filtra as paradas abertas). */
  ocorrencias: OcorrenciaNaTela[];
  nome: (id: string | null) => string;
  /** Caminho da foto → URL assinada. */
  fotos: Record<string, string>;
  estadoFoto: Record<string, EstadoFoto>;
  contexto: { obra: string; data: string; periodo: Periodo; whatsapp: string | null };
  /** Funções da equipe (formulário "Avisar parada"). */
  funcoes: string[];
  destinos: ResponsavelRef[];
  somenteLeitura?: boolean;
  /** Turno do planejador: todas as equipes, com "Voltamos a trabalhar" e WhatsApp (avisar é pelo efetivo de cada equipe). */
  planejador?: boolean;
  /** Planejador: pode avisar por qualquer equipe (escolhe a equipe antes). */
  criar: (d: DadosOcorrencia, foto: File | null) => void;
  encerrar: (id: string, hora: string) => void;
  tentarFoto: (id: string) => void;
  /** Foto depois (parada já registrada, sem foto). */
  anexarFoto?: (id: string, foto: File) => void;
};

const botao =
  "inline-flex min-h-12 items-center justify-center rounded-botao border border-operacional bg-superficie px-3 font-semibold text-primaria hover:bg-primaria-clara";
const botaoAlerta =
  "min-h-12 rounded-botao border-2 border-alerta bg-superficie px-3 text-base font-semibold text-texto hover:bg-alerta/10";
const campo =
  "min-h-12 rounded-botao border border-borda bg-superficie px-3 text-base text-texto focus-visible:outline-2 focus-visible:outline-operacional";

/** Topo do link de campo e do turno: "⚠ Avisar parada" e as paradas em aberto (voltar a trabalhar, WhatsApp, foto). */
export function PainelParadas(p: PropsPainelParadas) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [encerrando, setEncerrando] = useState<{ id: string; hora: string } | null>(null);
  const [retomadas, setRetomadas] = useState<string[]>([]);
  const daEquipe = (o: OcorrenciaNaTela) => p.responsavelId === null || o.responsavel_id === p.responsavelId;
  const abertas = p.ocorrencias.filter((o) => o.tipo === "parado" && !o.hora_fim && daEquipe(o));
  const voltaram = p.ocorrencias.filter((o) => retomadas.includes(o.id) && o.hora_fim && !o.pendente);
  const podeRegistrar = !p.somenteLeitura && p.responsavelId !== null && p.funcoes.length > 0;
  const ctx = (o: OcorrenciaNaTela) => ({ ...p.contexto, equipe: p.nome(o.responsavel_id) });

  return (
    <section className="flex flex-col gap-3" aria-label="Paradas">
      {podeRegistrar && !aberto && (
        <button type="button" className={botaoAlerta} onClick={() => { setErro(null); setAberto(true); }}>
          ⚠ Avisar parada
        </button>
      )}
      {aberto && (
        <FormParada
          responsavelId={p.responsavelId}
          funcoes={p.funcoes}
          destinos={p.destinos}
          cancelar={() => setAberto(false)}
          enviar={(f, foto) => {
            const d = montarParada(f, crypto.randomUUID());
            if (typeof d === "string") return setErro(d);
            setErro(null);
            setAberto(false);
            p.criar(d, foto);
          }}
        />
      )}
      {erro && <Aviso tom="alerta">{erro}</Aviso>}

      {abertas.map((o) => {
        const foto = o.foto_path ? p.fotos[o.foto_path] : undefined;
        const estado = p.estadoFoto[o.id];
        const confirmada = !o.pendente;
        const texto = mensagemParada({ ...ctx(o), o, aguardando: o.aguardando_responsavel_id ? p.nome(o.aguardando_responsavel_id) : null });
        return (
          <div key={o.id} className="flex flex-col gap-2 rounded-cartao border-2 border-perigo bg-perigo/5 p-3" role="status">
            <p className="font-semibold text-texto">
              ⚠ {p.responsavelId === null ? `${p.nome(o.responsavel_id)} · ` : ""}
              {`${pessoas(o.quantidade, o.funcao)} ${descreverOcorrencia(o, p.nome).replace(/^\d+ /, "")}`}
            </p>
            {o.observacao && <p className="text-sm text-texto">“{o.observacao}”</p>}
            {/* URL assinada do Storage (privada, curta): sem otimização do next/image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {foto && <img src={foto} alt="Foto da parada" className="max-h-40 w-auto self-start rounded-botao" />}
            {estado === "enviando" && <p className="text-sm text-texto-suave">Enviando foto…</p>}
            {estado === "falhou" && (
              <button type="button" className="self-start text-sm text-perigo underline" onClick={() => p.tentarFoto(o.id)}>
                Foto não enviada · tentar de novo
              </button>
            )}
            {o.foto_path && !estado && !foto && <p className="text-sm text-texto-suave">📷 foto enviada</p>}
            {!o.foto_path && !estado && confirmada && !p.somenteLeitura && p.anexarFoto && (
              <label className="self-start text-sm text-operacional underline">
                📷 Adicionar foto
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) p.anexarFoto!(o.id, f);
                  }}
                />
              </label>
            )}
            {!confirmada && <p className="text-sm text-texto-suave">Registrando…</p>}
            {confirmada && !p.somenteLeitura && daEquipe(o) && (p.responsavelId !== null || p.planejador) && (
              encerrando?.id === o.id ? (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col text-sm text-texto-suave">
                    Voltaram às
                    <input type="time" className={campo} value={encerrando.hora} onChange={(e) => setEncerrando({ id: o.id, hora: e.target.value })} />
                  </label>
                  <button
                    type="button"
                    className={botao}
                    onClick={() => {
                      if (!encerrando.hora) return;
                      p.encerrar(o.id, encerrando.hora);
                      setRetomadas((r) => [...r, o.id]);
                      setEncerrando(null);
                    }}
                  >
                    Confirmar
                  </button>
                  <button type="button" className="min-h-12 px-2 text-texto-suave underline" onClick={() => setEncerrando(null)}>Cancelar</button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={botao} onClick={() => setEncerrando({ id: o.id, hora: horaAgoraSaoPaulo() })}>
                    Voltamos a trabalhar
                  </button>
                  <a className={botao} href={linkWhatsapp(p.contexto.whatsapp, texto)} target="_blank" rel="noopener noreferrer">
                    Avisar no WhatsApp
                  </a>
                </div>
              )
            )}
          </div>
        );
      })}

      {voltaram.map((o) => (
        <div key={o.id} className="flex flex-wrap items-center gap-2 rounded-cartao border border-borda p-3">
          <p className="min-w-0 flex-1 text-sm text-texto">{`✅ ${pessoas(o.quantidade, o.funcao)} ${o.quantidade === 1 ? "voltou" : "voltaram"} às ${horaCurta(o.hora_fim!)}`}</p>
          <a className={botao} href={linkWhatsapp(p.contexto.whatsapp, mensagemRetomada({ ...ctx(o), o }))} target="_blank" rel="noopener noreferrer">
            Avisar no WhatsApp
          </a>
        </div>
      ))}
    </section>
  );
}
