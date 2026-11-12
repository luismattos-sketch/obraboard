"use client";

import { useRef, useState } from "react";
import type { Resultado } from "@/lib/db/resultado";
import { tuplaEfetivo } from "@/lib/dominio/assinatura";
import { canonizarFuncao, normalizarFuncao } from "@/lib/dominio/programacao";
import { criarFila } from "./fila";
import { IndicadorSalvo } from "./IndicadorSalvo";
import { Sincronizar } from "./Sincronizar";
import { useAutoSalvar } from "./useAutoSalvar";

type LinhaEfetivo = { funcao: string; quantidade: number };
/** `outra`: função digitada à mão (fora da lista de opções). */
type Linha = { chave: number; funcao: string; quantidade: string; outra: boolean };
const OUTRA = "__outra__";
type Props = {
  inicial: LinhaEfetivo[];
  /** Funções do menu (as da programação do turno; sem programação, as sugeridas padrão). */
  opcoes: string[];
  somenteLeitura?: boolean;
  /** `esperado`: o efetivo lido/salvo por último por esta tela (checagem otimista no servidor). */
  salvar: (linhas: LinhaEfetivo[], esperado: LinhaEfetivo[]) => Promise<Resultado<unknown>>;
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

function Efetivo({ inicial, opcoes, somenteLeitura, salvar }: Props) {
  const naLista = (f: string) => opcoes.some((o) => normalizarFuncao(o) === normalizarFuncao(f));
  const proxima = useRef(inicial.length);
  const esperado = useRef<LinhaEfetivo[]>(inicial.map((l) => ({ funcao: l.funcao, quantidade: l.quantidade })));
  const [linhas, setLinhas] = useState<Linha[]>(
    inicial.map((l, i) => {
      const outra = !naLista(l.funcao);
      return { chave: i, funcao: outra ? l.funcao : canonizarFuncao(l.funcao, opcoes), quantidade: String(l.quantidade), outra };
    }),
  );

  // Só vão para o servidor linhas completas e válidas (a linha em digitação fica local).
  const validas = linhas
    .map((l) => ({ funcao: canonizarFuncao(l.funcao, opcoes), quantidade: Number(l.quantidade) }))
    .filter((l) => l.funcao && Number.isInteger(l.quantidade) && l.quantidade > 0);
  // Em série: o próximo salvamento só lê `esperado` depois que o anterior gravou (senão, um
  // salvamento disparado durante outro lento iria com o esperado velho e daria conflito falso).
  const [fila] = useState(criarFila);
  const estado = useAutoSalvar(
    () =>
      fila(async () => {
        const r = await salvar(validas, esperado.current);
        if (r.ok) esperado.current = validas;
        return r;
      }),
    [tuplaEfetivo(validas)],
  );

  const mudar = (chave: number, p: Partial<Linha>) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...p } : l)));

  return (
    <section aria-labelledby="titulo-efetivo" className="flex flex-col gap-3">
      <h2 id="titulo-efetivo" className="text-lg font-semibold text-primaria">Efetivo</h2>
      {linhas.map((l) => (
        <div key={l.chave} className="flex items-start gap-2">
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
          </div>
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
            <button
              type="button"
              aria-label="Remover linha"
              className="min-h-12 min-w-12 rounded-botao border border-borda text-perigo"
              onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {!somenteLeitura && (
        <button
          type="button"
          className="min-h-12 rounded-botao border border-operacional bg-superficie font-semibold text-primaria hover:bg-primaria-clara"
          onClick={() => setLinhas((ls) => [...ls, { chave: proxima.current++, funcao: "", quantidade: "", outra: false }])}
        >
          + Adicionar função
        </button>
      )}
      {!somenteLeitura && <IndicadorSalvo {...estado} />}
    </section>
  );
}
