"use client";

import { useState } from "react";
import { Selo } from "@/components/ui/Selo";
import type { Tom } from "@/components/ui/tons";
import type { Atividade } from "@/lib/db/atividades";
import type { Resultado } from "@/lib/db/resultado";
import { statusAtividade } from "@/lib/dominio/calculos";
import { parseNumero } from "@/lib/dominio/entrada";
import { numeroBR } from "@/lib/dominio/formato";
import { CAUSAS, ROTULO_STATUS_ATIVIDADE, type AtividadeExec, type Causa, type StatusAtividade } from "@/lib/dominio/tipos";
import { IndicadorSalvo } from "./IndicadorSalvo";
import { useAutoSalvar } from "./useAutoSalvar";

export type DadosExecucao = { qtd_realizada: number | null; causa: Causa | null; observacao: string | null };

const TOM: Record<StatusAtividade, Tom> = { concluida: "sucesso", parcial: "alerta", nao_iniciada: "neutro" };
const campoBase =
  "min-h-12 w-full rounded-lg border border-borda bg-superficie px-3 text-base text-texto focus-visible:outline-2 focus-visible:outline-primaria disabled:opacity-70";

type Props = {
  atividades: Atividade[];
  somenteLeitura?: boolean;
  salvar: (atividadeId: string, dados: DadosExecucao) => Promise<Resultado<unknown>>;
  /** Estado atual de todas as atividades (para validar o envio). */
  onMudar?: (atividades: AtividadeExec[]) => void;
  erros?: Record<string, string>;
};

export function BlocoAtividades({ atividades, somenteLeitura, salvar, onMudar, erros = {} }: Props) {
  const [lista, setLista] = useState<AtividadeExec[]>(atividades);

  function mudou(novo: AtividadeExec) {
    const nova = lista.map((a) => (a.id === novo.id ? novo : a));
    setLista(nova);
    onMudar?.(nova);
  }

  return (
    <section aria-labelledby="titulo-atividades" className="flex flex-col gap-3">
      <h2 id="titulo-atividades" className="text-lg font-semibold">Atividades</h2>
      {atividades.map((a) => (
        <ItemExecucao
          key={a.id}
          atividade={a}
          somenteLeitura={somenteLeitura}
          erro={erros[a.id]}
          salvar={salvar}
          onMudar={mudou}
        />
      ))}
    </section>
  );
}

function ItemExecucao({
  atividade: a,
  somenteLeitura,
  erro,
  salvar,
  onMudar,
}: {
  atividade: Atividade;
  somenteLeitura?: boolean;
  erro?: string;
  salvar: Props["salvar"];
  onMudar: (a: AtividadeExec) => void;
}) {
  const [texto, setTexto] = useState(a.qtd_realizada === null ? "" : String(a.qtd_realizada).replace(".", ","));
  const [causa, setCausa] = useState<Causa | "">(a.causa ?? "");
  const [obs, setObs] = useState(a.observacao ?? "");

  const qtd = texto.trim() === "" ? null : parseNumero(texto);
  const qtdInvalida = texto.trim() !== "" && qtd === null;
  const status = statusAtividade(a.qtd_planejada, qtd);
  const naoConcluida = status !== "concluida";

  const estado = useAutoSalvar(
    async () => {
      if (qtdInvalida) return { ok: false as const, erro: "Digite um número válido" };
      return salvar(a.id, {
        qtd_realizada: qtd,
        causa: naoConcluida && causa ? causa : null,
        observacao: naoConcluida && obs.trim() ? obs : null,
      });
    },
    [texto, causa, obs],
  );

  function atualizar(t: string, c: Causa | "", o: string) {
    setTexto(t);
    setCausa(c);
    setObs(o);
    const q = t.trim() === "" ? null : parseNumero(t);
    if (t.trim() !== "" && q === null) return;
    onMudar({
      id: a.id,
      descricao: a.descricao,
      qtd_planejada: a.qtd_planejada,
      qtd_realizada: q,
      causa: c || null,
      observacao: o || null,
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-borda bg-superficie p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{a.descricao}</p>
          <p className="text-sm text-slate-600">
            {a.local ? `${a.local} · ` : ""}Previsto: {numeroBR(a.qtd_planejada)} {a.unidade}
          </p>
        </div>
        <Selo tom={TOM[status]}>{ROTULO_STATUS_ATIVIDADE[status]}</Selo>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor={`qtd-${a.id}`} className="text-sm font-medium">Executado ({a.unidade})</label>
          <input
            id={`qtd-${a.id}`}
            className={campoBase}
            inputMode="decimal"
            autoComplete="off"
            value={texto}
            disabled={somenteLeitura}
            aria-invalid={qtdInvalida || undefined}
            onChange={(e) => atualizar(e.target.value, causa, obs)}
          />
        </div>
        {!somenteLeitura && (
          <button
            type="button"
            className="min-h-12 rounded-lg border border-borda bg-superficie px-4 font-semibold text-primaria hover:bg-primaria-clara"
            onClick={() => atualizar(String(a.qtd_planejada).replace(".", ","), causa, obs)}
          >
            100%
          </button>
        )}
      </div>
      {qtdInvalida && <p className="text-sm text-perigo">Digite um número válido</p>}

      {naoConcluida && (
        <>
          <div>
            <label htmlFor={`causa-${a.id}`} className="text-sm font-medium">Causa do não cumprimento</label>
            <select
              id={`causa-${a.id}`}
              className={campoBase}
              value={causa}
              disabled={somenteLeitura}
              onChange={(e) => atualizar(texto, e.target.value as Causa | "", obs)}
            >
              <option value="">Selecione…</option>
              {(Object.keys(CAUSAS) as Causa[]).map((k) => (
                <option key={k} value={k}>{CAUSAS[k]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`obs-${a.id}`} className="text-sm font-medium">Observação</label>
            <textarea
              id={`obs-${a.id}`}
              className={`${campoBase} py-2`}
              rows={2}
              maxLength={500}
              value={obs}
              disabled={somenteLeitura}
              onChange={(e) => atualizar(texto, causa, e.target.value)}
            />
          </div>
          {erro && <p className="text-sm text-perigo">{erro}</p>}
        </>
      )}
      {!somenteLeitura && <IndicadorSalvo {...estado} />}
    </div>
  );
}
