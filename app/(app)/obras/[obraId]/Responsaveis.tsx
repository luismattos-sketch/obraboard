"use client";

import { useState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import { Campo } from "@/components/ui/Campo";

import { Selo } from "@/components/ui/Selo";
import type { Responsavel } from "@/lib/db/responsaveis";
import { criarResponsavelAcao, definirAtivoAcao, editarResponsavelAcao } from "./acoesResponsaveis";

type Edicao = { id: string | null; nome: string; telefone: string };

/** Seção "Responsáveis" da obra: lista, adicionar, editar, desativar/reativar. */
export function Responsaveis({ obraId, responsaveis }: { obraId: string; responsaveis: Responsavel[] }) {
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function executar(f: () => Promise<{ ok: boolean; erro?: string }>, aoTerminar?: () => void) {
    setOcupado(true);
    setErro(null);
    try {
      const r = await f();
      if (!r.ok) setErro(r.erro ?? "Não foi possível salvar.");
      else aoTerminar?.();
    } catch {
      setErro("Sem conexão — tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!edicao) return;
    const dados = { nome: edicao.nome, telefone: edicao.telefone };
    void executar(
      () => (edicao.id ? editarResponsavelAcao(obraId, edicao.id, dados) : criarResponsavelAcao(obraId, dados)),
      () => setEdicao(null),
    );
  }

  return (
    <details className="rounded-cartao border border-borda bg-superficie p-4">
      <summary className="cursor-pointer text-lg font-semibold text-primaria">
        Responsáveis ({responsaveis.filter((r) => r.ativo).length})
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-sm text-texto-suave">Quem assume as atividades no turno: encarregado, líder, supervisor…</p>
        {responsaveis.length > 0 && (
          <ul className="divide-y divide-borda">
            {responsaveis.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="flex items-center gap-2">
                  <span className={r.ativo ? "font-medium text-texto" : "text-texto-suave"}>{r.nome}</span>
                  {r.telefone && <span className="text-sm text-texto-suave">{r.telefone}</span>}
                  {!r.ativo && <Selo tom="neutro">inativo</Selo>}
                </div>
                <div className="flex gap-3 text-sm">
                  <button type="button" className="text-operacional underline" disabled={ocupado}
                    onClick={() => setEdicao({ id: r.id, nome: r.nome, telefone: r.telefone ?? "" })}>
                    Editar
                  </button>
                  <button type="button" className="text-operacional underline" disabled={ocupado}
                    onClick={() => void executar(() => definirAtivoAcao(obraId, r.id, !r.ativo))}>
                    {r.ativo ? "Desativar" : "Reativar"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {erro && <Aviso tom="perigo">{erro}</Aviso>}
        {edicao ? (
          <form onSubmit={salvar} className="flex flex-col gap-3">
            <Campo rotulo="Nome" maxLength={60} required autoFocus value={edicao.nome}
              onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} />
            <Campo rotulo="Telefone (opcional)" maxLength={30} inputMode="tel" value={edicao.telefone}
              onChange={(e) => setEdicao({ ...edicao, telefone: e.target.value })} />
            <div className="flex gap-2">
              <Botao type="submit" carregando={ocupado}>Salvar</Botao>
              <Botao type="button" variante="secundario" onClick={() => setEdicao(null)}>Cancelar</Botao>
            </div>
          </form>
        ) : (
          <Botao type="button" variante="secundario" onClick={() => setEdicao({ id: null, nome: "", telefone: "" })}>
            + Novo responsável
          </Botao>
        )}
      </div>
    </details>
  );
}
