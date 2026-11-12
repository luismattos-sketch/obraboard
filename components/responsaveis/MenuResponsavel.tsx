"use client";

import { useId, useState } from "react";
import { criarResponsavelAcao } from "@/app/(app)/obras/[obraId]/acoesResponsaveis";
import type { ResponsavelRef } from "@/lib/dominio/quadro";

const NOVO = "__novo__";
const campo =
  "min-h-12 w-full rounded-botao border border-borda bg-superficie px-3 text-base text-texto focus-visible:outline-2 focus-visible:outline-operacional disabled:opacity-70";

type Props = {
  obraId: string;
  responsaveis: ResponsavelRef[];
  valor: string | null;
  aoMudar: (id: string | null) => void;
  desabilitado?: boolean;
  /** Sem sessão do planejador (link de campo) não há "+ Novo responsável…". */
  podeCriar?: boolean;
  rotulo?: string;
};

/** Menu único de responsável: ativos em ordem alfabética, "Sem responsável" e "+ Novo responsável…". */
export function MenuResponsavel({ obraId, responsaveis, valor, aoMudar, desabilitado, podeCriar = true, rotulo = "Responsável" }: Props) {
  const id = useId();
  const [novo, setNovo] = useState<string | null>(null);
  const [criados, setCriados] = useState<ResponsavelRef[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const todos = [...responsaveis, ...criados.filter((c) => !responsaveis.some((r) => r.id === c.id))];
  const atual = valor ? todos.find((r) => r.id === valor) : undefined;
  const ativos = todos.filter((r) => r.ativo).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  async function criar() {
    if (!novo?.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await criarResponsavelAcao(obraId, { nome: novo });
      if (!r.ok) return setErro(r.erro);
      setCriados((cs) => [...cs, { id: r.dados.id, nome: r.dados.nome, ativo: true }]);
      setNovo(null);
      aoMudar(r.dados.id);
    } catch {
      setErro("Sem conexão — tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-texto">{rotulo}</label>
      <select
        id={id}
        className={campo}
        value={novo !== null ? NOVO : (valor ?? "")}
        disabled={desabilitado}
        onChange={(e) => {
          if (e.target.value === NOVO) return setNovo("");
          setNovo(null);
          aoMudar(e.target.value || null);
        }}
      >
        <option value="">Sem responsável</option>
        {atual && !atual.ativo && <option value={atual.id}>{atual.nome} (inativo)</option>}
        {ativos.map((r) => (
          <option key={r.id} value={r.id}>{r.nome}</option>
        ))}
        {podeCriar && <option value={NOVO}>+ Novo responsável…</option>}
      </select>
      {novo !== null && (
        <div className="flex gap-2">
          <input
            aria-label="Nome do novo responsável"
            maxLength={60}
            autoFocus
            className={campo}
            placeholder="Nome"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void criar();
              }
            }}
          />
          <button
            type="button"
            disabled={salvando || !novo.trim()}
            className="min-h-12 shrink-0 rounded-botao bg-primaria px-4 font-semibold text-white disabled:opacity-60"
            onClick={() => void criar()}
          >
            {salvando ? "Salvando…" : "Adicionar"}
          </button>
        </div>
      )}
      {erro && <p className="text-sm text-perigo">{erro}</p>}
    </div>
  );
}
