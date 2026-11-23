"use client";

import { useId } from "react";
import { Botao } from "@/components/ui/Botao";
import { Campo } from "@/components/ui/Campo";
import { canonizarFuncao } from "@/lib/dominio/programacao";

export type LinhaEquipe = { funcao: string; quantidade: string };
export const LINHA_VAZIA: LinhaEquipe = { funcao: "", quantidade: "" };

/** Linhas de equipe (função + quantidade). Os campos se chamam `funcao`/`quantidade` (lidos por `lerEquipeDoForm`). */
export function EditorEquipe({
  linhas,
  aoMudar,
  sugestoes,
  erro,
  legenda = "Equipe prevista",
}: {
  linhas: LinhaEquipe[];
  aoMudar: (linhas: LinhaEquipe[]) => void;
  sugestoes: string[];
  erro?: string;
  legenda?: string;
}) {
  const lista = useId();
  const mudar = (i: number, campo: keyof LinhaEquipe, valor: string) =>
    aoMudar(linhas.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-texto">{legenda}</legend>
      <datalist id={lista}>
        {sugestoes.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      {linhas.map((l, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Campo rotulo="Função" name="funcao" list={lista} maxLength={60} value={l.funcao} onChange={(e) => mudar(i, "funcao", e.target.value)} onBlur={() => mudar(i, "funcao", canonizarFuncao(l.funcao, sugestoes))} />
          </div>
          <div className="w-24">
            <Campo rotulo="Qtd" name="quantidade" inputMode="numeric" value={l.quantidade} onChange={(e) => mudar(i, "quantidade", e.target.value)} />
          </div>
          <Botao
            type="button"
            variante="secundario"
            className="min-h-12 px-3 text-sm"
            aria-label={`Remover função ${l.funcao || i + 1}`}
            onClick={() => aoMudar(linhas.length === 1 ? [LINHA_VAZIA] : linhas.filter((_, j) => j !== i))}
          >
            Remover
          </Botao>
        </div>
      ))}
      {erro && <p className="text-sm text-perigo">{erro}</p>}
      <div>
        <Botao type="button" variante="secundario" className="min-h-10 px-3 text-sm" onClick={() => aoMudar([...linhas, LINHA_VAZIA])}>
          Adicionar função
        </Botao>
      </div>
    </fieldset>
  );
}
