"use client";

import { Fragment, useCallback, useState } from "react";
import { Selo } from "@/components/ui/Selo";
import type { Atividade } from "@/lib/db/atividades";
import type { Resultado } from "@/lib/db/resultado";
import { tuplaExecucao } from "@/lib/dominio/assinatura";
import { statusAtividade } from "@/lib/dominio/calculos";
import { parseNumero } from "@/lib/dominio/entrada";
import { numeroBR } from "@/lib/dominio/formato";
import {
  CAUSAS,
  ROTULO_STATUS_ATIVIDADE,
  type AtividadeExec,
  type Causa,
  type DadosExecucao,
  type StatusAtividade,
  type Tom,
} from "@/lib/dominio/tipos";
import { IndicadorSalvo } from "./IndicadorSalvo";
import { Sincronizar } from "./Sincronizar";
import { useAutoSalvar } from "./useAutoSalvar";

const TOM: Record<StatusAtividade, Tom> = { concluida: "sucesso", parcial: "alerta", nao_iniciada: "neutro" };
const campoBase =
  "min-h-12 w-full rounded-botao border border-borda bg-superficie px-3 text-base text-texto focus-visible:outline-2 focus-visible:outline-operacional disabled:opacity-70";

const tuplaServidor = (a: Atividade) => tuplaExecucao(a.qtd_planejada, a.qtd_realizada, a.causa, a.observacao);

/** Edição local por atividade, válida só enquanto o servidor ainda mostra a versão de onde ela partiu. */
type Local = { base: string; qtd_realizada: number | null; causa: Causa | null; observacao: string | null };
export type MudarExecucao = (atividade: Atividade, local: Omit<Local, "base">) => void;

/**
 * Estado das atividades para validar o envio (causas pendentes): o que o usuário editou por cima
 * dos dados do servidor. Quando o servidor muda (revalidação), vale o servidor.
 */
export function useExecucaoLocal(atividades: Atividade[]): { lista: AtividadeExec[]; mudar: MudarExecucao } {
  const [locais, setLocais] = useState<Record<string, Local>>({});
  const lista = atividades.map((a) => {
    const l = locais[a.id];
    if (!l || l.base !== JSON.stringify(tuplaServidor(a))) return a;
    return { ...a, qtd_realizada: l.qtd_realizada, causa: l.causa, observacao: l.observacao };
  });
  const mudar = useCallback<MudarExecucao>((a, local) => {
    setLocais((m) => ({ ...m, [a.id]: { base: JSON.stringify(tuplaServidor(a)), ...local } }));
  }, []);
  return { lista, mudar };
}

type Props = {
  atividades: Atividade[];
  somenteLeitura?: boolean;
  salvar: (atividadeId: string, dados: DadosExecucao) => Promise<Resultado<unknown>>;
  /** Avisa cada edição (ver useExecucaoLocal). */
  onMudar?: MudarExecucao;
  erros?: Record<string, string>;
  /** Agrupa por responsável: subtítulo antes da 1ª atividade de cada grupo (na ordem recebida). */
  grupoDe?: (a: Atividade) => string | null;
};

export function BlocoAtividades({ atividades, somenteLeitura, salvar, onMudar, erros = {}, grupoDe }: Props) {
  return (
    <section aria-labelledby="titulo-atividades" className="flex flex-col gap-3">
      <h2 id="titulo-atividades" className="text-lg font-semibold text-primaria">Atividades</h2>
      {atividades.map((a, i) => (
        <Fragment key={a.id}>
        {grupoDe && (i === 0 || grupoDe(atividades[i - 1]) !== grupoDe(a)) && (
          <h3 className="mt-2 font-semibold text-texto">{grupoDe(a) ?? "Sem responsável"}</h3>
        )}
        <Sincronizar servidor={tuplaServidor(a)}>
          <ItemExecucao
            atividade={a}
            somenteLeitura={somenteLeitura}
            erro={erros[a.id]}
            salvar={salvar}
            onMudar={onMudar}
          />
        </Sincronizar>
        </Fragment>
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
  onMudar?: MudarExecucao;
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
    tuplaExecucao(a.qtd_planejada, qtdInvalida ? texto : qtd, causa, obs),
  );

  function atualizar(t: string, c: Causa | "", o: string) {
    setTexto(t);
    setCausa(c);
    setObs(o);
    const q = t.trim() === "" ? null : parseNumero(t);
    if (t.trim() !== "" && q === null) return;
    onMudar?.(a, { qtd_realizada: q, causa: c || null, observacao: o || null });
  }

  return (
    <div className="flex flex-col gap-3 rounded-cartao border border-borda bg-superficie p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{a.descricao}</p>
          <p className="text-sm text-texto-suave">
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
        {!somenteLeitura && naoConcluida && (
          <button
            type="button"
            aria-label={`Marcar como concluída: ${a.descricao}`}
            className="min-h-12 rounded-botao border border-operacional bg-superficie px-4 font-semibold text-primaria hover:bg-primaria-clara"
            onClick={() => atualizar(String(a.qtd_planejada).replace(".", ","), causa, obs)}
          >
            ✓ Concluída
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
