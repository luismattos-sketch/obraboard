"use client";

import { useContext, useId, useRef, useState } from "react";
import type { Resultado } from "@/lib/db/resultado";
import { tuplaEfetivo } from "@/lib/dominio/assinatura";
import { notaDigitadoEfetivo } from "@/lib/dominio/conflito";
import { canonizarFuncao, normalizarFuncao } from "@/lib/dominio/programacao";
import { ERRO_FUNCAO_PARADO, pareceParado } from "@/lib/db/validacao";
import { criarFila } from "./fila";
import { IndicadorSalvo } from "./IndicadorSalvo";
import { ContextoSincronia, Sincronizar } from "./Sincronizar";
import { useAutoSalvar } from "./useAutoSalvar";

type LinhaEfetivo = { funcao: string; quantidade: number };
/** `outra`: função digitada à mão (fora da lista de opções). */
type Linha = { chave: number; funcao: string; quantidade: string; outra: boolean };
const OUTRA = "__outra__";
export const TEXTO_PREVISTO = "Previsto pela programação — confirme ou ajuste";
/** Key do bloco: enquanto nada foi gravado, muda com o previsto (atividade nova remonta com a soma nova). */
export function chaveBloco(inicial: LinhaEfetivo[], previsto: LinhaEfetivo[] | undefined): string {
  return inicial.length > 0 ? "gravado" : `previsto:${JSON.stringify(previsto ?? [])}`;
}

/** −/+ da quantidade (mínimo 1). */
export function passoQuantidade(q: string, delta: 1 | -1): string {
  const n = Number(q) || 0;
  return String(Math.max(1, n + delta));
}
type Props = {
  inicial: LinhaEfetivo[];
  /** Funções do menu (as da programação do turno; sem programação, as sugeridas padrão). */
  opcoes: string[];
  somenteLeitura?: boolean;
  /** `esperado`: o efetivo lido/salvo por último por esta tela (checagem otimista no servidor). */
  salvar: (linhas: LinhaEfetivo[], esperado: LinhaEfetivo[]) => Promise<Resultado<unknown>>;
  /** Dentro do efetivo por equipe: subtítulo (h3) com o nome da equipe. */
  equipe?: string;
  /** Equipe prevista: mostrada (sem gravar) enquanto não há efetivo gravado; grava ao confirmar ou ajustar. */
  previsto?: LinhaEfetivo[];
};
const campo =
  "min-h-12 rounded-botao border border-borda bg-superficie px-3 text-base text-texto focus-visible:outline-2 focus-visible:outline-operacional disabled:opacity-70";

export function BlocoEfetivo(props: Props) {
  return (
    <Sincronizar servidor={[tuplaEfetivo(props.inicial)]}>
      <Efetivo {...props} />
    </Sincronizar>
  );
}

function Efetivo({ inicial, opcoes, somenteLeitura, salvar, equipe, previsto = [] }: Props) {
  const [pendente, setPendente] = useState(() => !somenteLeitura && inicial.length === 0 && previsto.length > 0);
  const idEquipe = useId();
  const idTitulo = equipe === undefined ? "titulo-efetivo" : idEquipe;
  const naLista = (f: string) => opcoes.some((o) => normalizarFuncao(o) === normalizarFuncao(f));
  const proxima = useRef(Math.max(inicial.length, previsto.length));
  const esperado = useRef<LinhaEfetivo[]>(inicial.map((l) => ({ funcao: l.funcao, quantidade: l.quantidade })));
  const [linhas, setLinhas] = useState<Linha[]>(
    (pendente ? previsto : inicial).map((l, i) => {
      const outra = !naLista(l.funcao);
      return { chave: i, funcao: outra ? l.funcao : canonizarFuncao(l.funcao, opcoes), quantidade: String(l.quantidade), outra };
    }),
  );

  // "Mecânico parado" não é função: vai em "Parados" (linhas antigas já gravadas continuam).
  const recusada = (l: Linha) => l.outra && pareceParado(l.funcao) && !inicial.some((i) => i.funcao.trim() === l.funcao.trim());
  // Só vão para o servidor linhas completas e válidas (a linha em digitação fica local).
  const validas = linhas
    .filter((l) => !recusada(l))
    .map((l) => ({ funcao: canonizarFuncao(l.funcao, opcoes), quantidade: Number(l.quantidade) }))
    .filter((l) => l.funcao && Number.isInteger(l.quantidade) && l.quantidade > 0);
  // Em série: o próximo salvamento só lê `esperado` depois que o anterior gravou (senão, um
  // salvamento disparado durante outro lento iria com o esperado velho e daria conflito falso).
  const [fila] = useState(criarFila);
  // Envios que caíram sem resposta (podem ter sido gravados mesmo assim).
  const semResposta = useRef<LinhaEfetivo[][]>([]);
  const sincronia = useContext(ContextoSincronia);
  const estado = useAutoSalvar(
    () =>
      fila(async () => {
        const enviar = async (base: LinhaEfetivo[]) => {
          try {
            return await salvar(validas, base);
          } catch (e) {
            const k = JSON.stringify(tuplaEfetivo(validas));
            semResposta.current = [...semResposta.current.filter((l) => JSON.stringify(tuplaEfetivo(l)) !== k), validas].slice(-5);
            throw e;
          }
        };
        let r = await enviar(esperado.current);
        // Envio anterior sem resposta pode ter sido gravado: tenta com ele como base (o banco confere).
        for (const base of [...semResposta.current].reverse()) {
          if (r.ok || !r.conflito) break;
          r = await enviar(base);
        }
        if (r.ok) {
          esperado.current = validas;
          semResposta.current = [];
        }
        return r;
      }),
    // Previsto ainda não confirmado: chave fixa (nada a salvar); confirmar/ajustar troca para o efetivo real.
    pendente ? ["previsto"] : [tuplaEfetivo(validas)],
  );

  const editar = (f: (ls: Linha[]) => Linha[]) => {
    setPendente(false);
    setLinhas(f);
  };
  const mudar = (chave: number, p: Partial<Linha>) => editar((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...p } : l)));
  const passo = "min-h-12 min-w-12 rounded-botao border border-borda bg-superficie text-xl font-semibold text-primaria";

  return (
    <section aria-labelledby={idTitulo} className="flex flex-col gap-3">
      {equipe === undefined ? (
        <h2 id={idTitulo} className="text-lg font-semibold text-primaria">Efetivo</h2>
      ) : (
        <h3 id={idTitulo} className="font-semibold text-texto">{equipe}</h3>
      )}
      {pendente && (
        <div className="flex flex-col gap-2 rounded-botao border border-operacional bg-primaria-clara p-3">
          <p className="text-sm text-texto">{TEXTO_PREVISTO}</p>
          <button type="button" className={`${passo} px-4 text-base`} onClick={() => setPendente(false)}>
            Confirmar equipe
          </button>
        </div>
      )}
      {linhas.map((l) => (
        <div key={l.chave} className="flex flex-col gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <select
              aria-label="Função"
              className={`${campo} w-full`}
              value={l.outra ? OUTRA : l.funcao}
              disabled={somenteLeitura}
              onChange={(e) =>
                mudar(l.chave, e.target.value === OUTRA ? { outra: true, funcao: "" } : { outra: false, funcao: e.target.value })
              }
            >
              <option value="">Selecione a função…</option>
              {opcoes.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
              <option value={OUTRA}>Outra função…</option>
            </select>
            {l.outra && (
              <input
                aria-label="Nome da função"
                maxLength={60}
                className={`${campo} w-full`}
                placeholder="Digite a função"
                value={l.funcao}
                disabled={somenteLeitura}
                autoFocus={!somenteLeitura && l.funcao === ""}
                onChange={(e) => mudar(l.chave, { funcao: e.target.value })}
                onBlur={() => {
                  // Digitou uma função que já está na lista: volta para ela (mesma grafia).
                  if (naLista(l.funcao)) mudar(l.chave, { outra: false, funcao: canonizarFuncao(l.funcao, opcoes) });
                }}
              />
            )}
            {recusada(l) && <p className="text-sm text-perigo">{ERRO_FUNCAO_PARADO}</p>}
          </div>
          <div className="flex items-center gap-2">
          {!somenteLeitura && (
            <button type="button" aria-label="Diminuir" className={passo} onClick={() => mudar(l.chave, { quantidade: passoQuantidade(l.quantidade, -1) })}>
              −
            </button>
          )}
          <input
            aria-label="Quantidade"
            inputMode="numeric"
            maxLength={3}
            className={`${campo} w-20 text-center`}
            placeholder="Qtd"
            value={l.quantidade}
            disabled={somenteLeitura}
            onChange={(e) => mudar(l.chave, { quantidade: e.target.value.replace(/\D/g, "") })}
          />
          {!somenteLeitura && (
            <button type="button" aria-label="Aumentar" className={passo} onClick={() => mudar(l.chave, { quantidade: passoQuantidade(l.quantidade, 1) })}>
              +
            </button>
          )}
          {!somenteLeitura && (
            <button
              type="button"
              aria-label="Remover linha"
              className="ml-auto min-h-12 min-w-12 rounded-botao border border-borda text-perigo"
              onClick={() => editar((ls) => ls.filter((x) => x.chave !== l.chave))}
            >
              ✕
            </button>
          )}
          </div>
        </div>
      ))}
      {!somenteLeitura && (
        <button
          type="button"
          className="min-h-12 rounded-botao border border-operacional bg-superficie font-semibold text-primaria hover:bg-primaria-clara"
          onClick={() => editar((ls) => [...ls, { chave: proxima.current++, funcao: "", quantidade: "", outra: false }])}
        >
          + Adicionar função
        </button>
      )}
      {!somenteLeitura && (
        <IndicadorSalvo {...estado} onVerAtual={() => sincronia?.recarregar(notaDigitadoEfetivo(validas))} nota={sincronia?.nota} />
      )}
    </section>
  );
}
