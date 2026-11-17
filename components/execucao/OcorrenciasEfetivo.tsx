"use client";

import { useState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import type { DadosOcorrencia } from "@/lib/db/validacao";
import { descreverOcorrencia, type HHEquipe, type Ocorrencia, type TipoOcorrencia } from "@/lib/dominio/efetivoHH";
import { hhBR } from "@/lib/dominio/formato";
import type { ResponsavelRef } from "@/lib/dominio/quadro";
import { CAUSAS, type Causa } from "@/lib/dominio/tipos";

/** Ocorrência ainda não confirmada pelo servidor (aparece como "salvando…"). */
export type OcorrenciaNaTela = Ocorrencia & { pendente?: boolean };

export type FormDados = {
  tipo: TipoOcorrencia;
  quantidade: string;
  funcao: string;
  destino: string;
  inicio: string;
  fim: string;
  causa: string;
  /** Saída/parados sobre pessoas recebidas por empréstimo. */
  emprestimoId: string | null;
};

/** Formulário → registro a enviar, ou a mensagem do que falta. */
export function montarOcorrencia(f: FormDados, id: string): DadosOcorrencia | string {
  const quantidade = Number(f.quantidade);
  if (!f.quantidade || !Number.isInteger(quantidade) || quantidade < 1) return "Informe a quantidade";
  if (!f.funcao) return "Escolha a função";
  if (!f.inicio) return "Informe o horário";
  const base = {
    id, tipo: f.tipo, funcao: f.funcao, quantidade, hora_inicio: f.inicio, hora_fim: null as string | null,
    destino_responsavel_id: null as string | null, emprestimo_id: f.emprestimoId, causa: null as Causa | null,
  };
  if (f.tipo === "emprestimo") {
    if (!f.destino) return "Escolha a equipe que recebe";
    return { ...base, destino_responsavel_id: f.destino, hora_fim: f.fim || null };
  }
  if (f.tipo === "parado") {
    if (!f.causa) return "Informe a causa";
    if (!f.fim) return "Informe até que horas ficaram parados";
    return { ...base, causa: f.causa as Causa, hora_fim: f.fim };
  }
  return base;
}

const campo =
  "min-h-12 rounded-botao border border-borda bg-superficie px-3 text-base text-texto focus-visible:outline-2 focus-visible:outline-operacional";
const botao =
  "min-h-12 rounded-botao border border-operacional bg-superficie px-3 font-semibold text-primaria hover:bg-primaria-clara";
const TITULO: Record<TipoOcorrencia, string> = { emprestimo: "Emprestar", saida: "Saída antes", parado: "Parados" };

export function FormOcorrencia({
  tipo,
  responsavelId,
  funcoes,
  destinos,
  emprestimoId = null,
  enviar,
  cancelar,
}: {
  tipo: TipoOcorrencia;
  responsavelId: string | null;
  /** Funções da equipe (ou a função fixa do empréstimo recebido). */
  funcoes: string[];
  destinos: ResponsavelRef[];
  emprestimoId?: string | null;
  enviar: (d: FormDados) => void;
  cancelar: () => void;
}) {
  const [f, setF] = useState<FormDados>({
    tipo, quantidade: "", funcao: funcoes[0] ?? "", destino: "", inicio: "", fim: "", causa: "", emprestimoId,
  });
  const mudar = (p: Partial<FormDados>) => setF((x) => ({ ...x, ...p }));
  const outras = destinos.filter((d) => d.id !== responsavelId && d.ativo);
  return (
    <form
      className="flex flex-col gap-2 rounded-botao border border-borda p-3"
      onSubmit={(e) => {
        e.preventDefault();
        enviar(f);
      }}
    >
      <p className="font-semibold text-texto">{TITULO[tipo]}</p>
      <div className="flex gap-2">
        <input
          aria-label="Quantas pessoas"
          inputMode="numeric"
          maxLength={3}
          placeholder="Qtd"
          className={`${campo} w-20 text-center`}
          value={f.quantidade}
          onChange={(e) => mudar({ quantidade: e.target.value.replace(/\D/g, "") })}
        />
        {funcoes.length > 1 ? (
          <select aria-label="Função" className={`${campo} min-w-0 flex-1`} value={f.funcao} onChange={(e) => mudar({ funcao: e.target.value })}>
            {funcoes.map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
          </select>
        ) : (
          <span className="flex min-h-12 items-center text-texto">{f.funcao}</span>
        )}
      </div>
      {tipo === "emprestimo" && (
        <select aria-label="Para qual equipe" className={campo} value={f.destino} onChange={(e) => mudar({ destino: e.target.value })}>
          <option value="">Para qual equipe?</option>
          {outras.map((d) => (
            <option key={d.id} value={d.id}>{d.nome}</option>
          ))}
        </select>
      )}
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col text-sm text-texto-suave">
          {tipo === "saida" ? "Saíram às" : tipo === "parado" ? "De" : "A partir de"}
          <input type="time" className={campo} value={f.inicio} onChange={(e) => mudar({ inicio: e.target.value })} />
        </label>
        {tipo !== "saida" && (
          <label className="flex flex-col text-sm text-texto-suave">
            {tipo === "parado" ? "Até" : "Até (opcional)"}
            <input type="time" className={campo} value={f.fim} onChange={(e) => mudar({ fim: e.target.value })} />
          </label>
        )}
      </div>
      {tipo === "parado" && (
        <select aria-label="Causa" className={campo} value={f.causa} onChange={(e) => mudar({ causa: e.target.value })}>
          <option value="">Por quê?</option>
          {(Object.keys(CAUSAS) as Causa[]).map((c) => (
            <option key={c} value={c}>{CAUSAS[c]}</option>
          ))}
        </select>
      )}
      <div className="flex gap-2">
        <button type="submit" className={`${botao} flex-1`}>Registrar</button>
        <button type="button" className="min-h-12 rounded-botao px-3 text-texto-suave underline" onClick={cancelar}>Cancelar</button>
      </div>
    </form>
  );
}

type Aberto = { tipo: TipoOcorrencia; emprestimoId: string | null; funcoes: string[] } | null;

/** Empréstimo, saída antes e parados de uma equipe (sob o efetivo dela). */
export function OcorrenciasEfetivo({
  responsavelId,
  funcoes,
  ocorrencias,
  destinos,
  nome,
  resumo,
  somenteLeitura,
  criar,
  remover,
}: {
  responsavelId: string | null;
  /** Funções gravadas no efetivo desta equipe. */
  funcoes: string[];
  /** Todas as ocorrências do turno (esta equipe filtra as suas). */
  ocorrencias: OcorrenciaNaTela[];
  destinos: ResponsavelRef[];
  nome: (id: string | null) => string;
  resumo: HHEquipe | null;
  somenteLeitura?: boolean;
  criar: (d: DadosOcorrencia) => Promise<unknown> | void;
  remover: (id: string) => Promise<unknown> | void;
}) {
  const [aberto, setAberto] = useState<Aberto>(null);
  const [erro, setErro] = useState<string | null>(null);
  const proprias = ocorrencias.filter((o) => o.responsavel_id === responsavelId && o.emprestimo_id === null);
  const sobre = (emprestimoId: string) => ocorrencias.filter((o) => o.emprestimo_id === emprestimoId);
  const recebidos = resumo?.recebidos ?? [];

  const Item = ({ o }: { o: OcorrenciaNaTela }) => (
    <li className="flex items-center gap-2 text-sm text-texto">
      <span className="min-w-0 flex-1">↳ {descreverOcorrencia(o, nome)}{o.pendente && <span className="text-texto-suave"> · salvando…</span>}</span>
      {!somenteLeitura && o.responsavel_id === responsavelId && (
        <button type="button" aria-label="Remover registro" className="min-h-10 min-w-10 rounded-botao border border-borda text-perigo" onClick={() => remover(o.id)}>
          ✕
        </button>
      )}
    </li>
  );

  const abrir = (tipo: TipoOcorrencia, emprestimoId: string | null, fs: string[]) => {
    setErro(null);
    setAberto({ tipo, emprestimoId, funcoes: fs });
  };
  const botoes = (tipos: TipoOcorrencia[], emprestimoId: string | null, fs: string[]) =>
    !somenteLeitura && aberto === null && (
      <div className="flex flex-wrap gap-2">
        {tipos.map((t) => (
          <button key={t} type="button" className={`${botao} text-sm`} onClick={() => abrir(t, emprestimoId, fs)}>
            + {TITULO[t]}
          </button>
        ))}
      </div>
    );

  return (
    <div className="flex flex-col gap-2">
      {proprias.length > 0 && (
        <ul className="flex flex-col gap-1">
          {proprias.map((o) => <Item key={o.id} o={o} />)}
        </ul>
      )}
      {funcoes.length > 0 && botoes(destinos.some((d) => d.id !== responsavelId && d.ativo) ? ["emprestimo", "saida", "parado"] : ["saida", "parado"], null, funcoes)}
      {recebidos.map((r) => (
        <div key={r.emprestimo_id} className="flex flex-col gap-1 rounded-botao bg-primaria-clara/40 p-2">
          <p className="text-sm font-medium text-texto">{`+${r.quantidade} ${r.funcao} (da ${nome(r.de)}, ${r.inicio}–${r.fim})`}</p>
          <ul className="flex flex-col gap-1">
            {sobre(r.emprestimo_id).map((o) => <Item key={o.id} o={o} />)}
          </ul>
          {botoes(["saida", "parado"], r.emprestimo_id, [r.funcao])}
        </div>
      ))}
      {aberto && (
        <FormOcorrencia
          tipo={aberto.tipo}
          responsavelId={responsavelId}
          funcoes={aberto.funcoes}
          destinos={destinos}
          emprestimoId={aberto.emprestimoId}
          cancelar={() => setAberto(null)}
          enviar={(f) => {
            const d = montarOcorrencia(f, crypto.randomUUID());
            if (typeof d === "string") return setErro(d);
            setErro(null);
            setAberto(null);
            void criar(d);
          }}
        />
      )}
      {erro && <Aviso tom="alerta">{erro}</Aviso>}
      {resumo?.avisos.map((a) => (
        <Aviso key={a} tom="alerta">{a}</Aviso>
      ))}
      {resumo && resumo.hhProdutivo !== null && (
        <p className="text-sm text-texto-suave">
          {`${resumo.pessoas} ${resumo.pessoas === 1 ? "pessoa" : "pessoas"} · ${hhBR(resumo.hhProdutivo + (resumo.hhParado ?? 0))} HH`}
          {resumo.hhParado ? ` (${hhBR(resumo.hhParado)} HH parados)` : ""}
        </p>
      )}
    </div>
  );
}
