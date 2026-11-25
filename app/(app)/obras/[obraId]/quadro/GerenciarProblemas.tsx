"use client";

import { useId, useState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import { Campo } from "@/components/ui/Campo";
import { ROTULO_TIPO_PROBLEMA, vencido, type Problema, type TipoProblema } from "@/lib/dominio/problemas";
import { apagarProblemaAcao, criarProblemaAcao, definirResolvidoAcao, editarProblemaAcao } from "../acoesQuadro";

type Edicao = { id: string | null; tipo: TipoProblema; descricao: string; acao: string; responsavel: string; prazo: string };
const VAZIO: Edicao = { id: null, tipo: "problema", descricao: "", acao: "", responsavel: "", prazo: "" };
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Item 2.5: cadastro de problemas e oportunidades (planejador). O quadro e a TV só mostram os abertos. */
export function GerenciarProblemas({
  obraId,
  problemas,
  sugestoes,
  hoje,
}: {
  obraId: string;
  problemas: Problema[];
  sugestoes: string[];
  hoje: string;
}) {
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const idLista = useId();
  const abertos = problemas.filter((p) => !p.resolvido_em).length;

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
    const { id, ...dados } = edicao;
    void executar(() => (id ? editarProblemaAcao(obraId, id, dados) : criarProblemaAcao(obraId, dados)), () => setEdicao(null));
  }

  return (
    <details className="rounded-cartao border border-borda bg-superficie p-4" data-testid="gerenciar-problemas">
      <summary className="cursor-pointer text-lg font-semibold text-primaria">{`Problemas e oportunidades (${abertos} em aberto)`}</summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-sm text-texto-suave">
          O que atrapalha ou pode melhorar a obra, com a ação, quem cuida e o prazo. Os itens em aberto aparecem no quadro e na TV.
        </p>
        {problemas.length > 0 && (
          <ul className="divide-y divide-borda">
            {problemas.map((p) => (
              <li key={p.id} className="flex flex-col gap-1 py-2">
                <p className={p.resolvido_em ? "text-texto-suave line-through" : "text-texto"}>
                  <span className="mr-1.5 text-xs font-bold">{ROTULO_TIPO_PROBLEMA[p.tipo]}:</span>
                  {p.descricao}
                </p>
                {p.acao && <p className="text-sm text-texto-suave">{`Ação: ${p.acao}`}</p>}
                <p className={`text-sm ${vencido(p, hoje) ? "font-semibold text-perigo" : "text-texto-suave"}`}>
                  {[p.responsavel, p.prazo && `prazo ${ddmm(p.prazo)}${vencido(p, hoje) ? " · vencido" : ""}`, p.resolvido_em && "resolvido"]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="flex gap-3 text-sm">
                  <button type="button" className="text-operacional underline" disabled={ocupado}
                    onClick={() => void executar(() => definirResolvidoAcao(obraId, p.id, !p.resolvido_em))}>
                    {p.resolvido_em ? "Reabrir" : "Resolvido"}
                  </button>
                  <button type="button" className="text-operacional underline" disabled={ocupado}
                    onClick={() => setEdicao({ id: p.id, tipo: p.tipo, descricao: p.descricao, acao: p.acao ?? "", responsavel: p.responsavel ?? "", prazo: p.prazo ?? "" })}>
                    Editar
                  </button>
                  <button type="button" className="text-texto-suave underline" disabled={ocupado}
                    onClick={() => {
                      if (window.confirm("Apagar este item? Não dá para desfazer.")) void executar(() => apagarProblemaAcao(obraId, p.id));
                    }}>
                    Apagar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {erro && <Aviso tom="perigo">{erro}</Aviso>}
        {edicao ? (
          <form onSubmit={salvar} className="flex flex-col gap-3">
            <fieldset className="flex gap-4">
              <legend className="mb-1 text-sm font-medium text-texto">Tipo</legend>
              {(["problema", "oportunidade"] as const).map((t) => (
                <label key={t} className="flex min-h-12 items-center gap-2">
                  <input type="radio" name="tipo" checked={edicao.tipo === t} onChange={() => setEdicao({ ...edicao, tipo: t })} />
                  {ROTULO_TIPO_PROBLEMA[t]}
                </label>
              ))}
            </fieldset>
            <Campo rotulo="Descrição" maxLength={300} required autoFocus value={edicao.descricao}
              placeholder="Ex.: andaime da área 3 sem liberação"
              onChange={(e) => setEdicao({ ...edicao, descricao: e.target.value })} />
            <Campo rotulo="Ação (opcional)" maxLength={300} value={edicao.acao}
              placeholder="Ex.: pedir liberação ao fiscal"
              onChange={(e) => setEdicao({ ...edicao, acao: e.target.value })} />
            <Campo rotulo="Responsável (opcional)" maxLength={60} list={idLista} value={edicao.responsavel}
              onChange={(e) => setEdicao({ ...edicao, responsavel: e.target.value })} />
            <datalist id={idLista}>
              {sugestoes.map((s) => <option key={s} value={s} />)}
            </datalist>
            <Campo rotulo="Prazo (opcional)" type="date" value={edicao.prazo}
              onChange={(e) => setEdicao({ ...edicao, prazo: e.target.value })} />
            <div className="flex gap-2">
              <Botao type="submit" carregando={ocupado}>Salvar</Botao>
              <Botao type="button" variante="secundario" onClick={() => setEdicao(null)}>Cancelar</Botao>
            </div>
          </form>
        ) : (
          <Botao type="button" variante="secundario" onClick={() => setEdicao(VAZIO)}>+ Problema ou oportunidade</Botao>
        )}
      </div>
    </details>
  );
}
