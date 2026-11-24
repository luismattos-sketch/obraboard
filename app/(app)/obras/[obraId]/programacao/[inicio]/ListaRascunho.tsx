"use client";

import { useActionState, useRef, useState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { numeroBR } from "@/lib/dominio/formato";
import { resumoDias, resumoEquipe, type AtividadeProgramada } from "@/lib/dominio/programacao";
import { agruparSequencias, proximoTurno } from "@/lib/dominio/sequencia";
import { contarSemResponsavel, textoSemResponsavel, type ResponsavelRef } from "@/lib/dominio/quadro";
import type { PendenteAnterior } from "@/lib/dominio/trazerSaldo";
import { programarSemanaAcao, removerAtividadeProgramadaAcao, type EstadoSemana } from "./acoes";
import { AvisoSaldoMudou } from "./AvisoSaldoMudou";
import { FormAtividadeProgramada } from "./FormAtividadeProgramada";
import { NaoConcluidasAnterior } from "./NaoConcluidasAnterior";

type Comum = { semanaId: string; obraId: string; responsaveis: ResponsavelRef[]; sugestoesFuncao: string[] };
type Trazida = { id: string; saldo: number };

function ItemRascunho({
  atividade: a,
  aoDuplicar,
  aoContinuar,
  saldoAtual,
  ...comum
}: Comum & { atividade: AtividadeProgramada; aoDuplicar: () => void; aoContinuar: (() => void) | null; saldoAtual?: number }) {
  const { responsaveis } = comum;
  const nome = a.responsavel_id ? responsaveis.find((r) => r.id === a.responsavel_id)?.nome : null;
  const [editando, setEditando] = useState(false);
  const [estado, action, pendente] = useActionState<EstadoSemana, FormData>(removerAtividadeProgramadaAcao, null);
  if (editando) {
    return (
      <li className="py-3">
        <FormAtividadeProgramada {...comum} atividade={a} aoConcluir={() => setEditando(false)} />
      </li>
    );
  }
  return (
    <li className="flex flex-col gap-2 py-3">
      <div>
        <p className="font-semibold text-texto">{a.descricao}</p>
        <p className="text-sm text-texto-suave">
          Meta {numeroBR(a.meta)} {a.unidade ?? ""} · {resumoDias(a.dias)} · {a.periodo === "diurno" ? "Diurno" : "Noturno"}
          {a.local ? ` · ${a.local}` : ""}
        </p>
        <p className="text-sm text-texto-suave">{resumoEquipe(a.equipe)}</p>
        <p className="text-sm text-texto-suave">Responsável: {nome ?? "sem responsável"}</p>
      </div>
      {saldoAtual !== undefined && <AvisoSaldoMudou atividade={a} saldoAtual={saldoAtual} />}
      <div className="flex flex-wrap gap-2">
        <Botao type="button" variante="secundario" className="min-h-10 px-3 text-sm" onClick={() => setEditando(true)}>
          Editar
        </Botao>
        <Botao type="button" variante="secundario" className="min-h-10 px-3 text-sm" onClick={aoDuplicar}>
          Duplicar
        </Botao>
        {aoContinuar && (
          <Botao type="button" variante="secundario" className="min-h-10 px-3 text-sm" onClick={aoContinuar}>
            Continuar no próximo turno
          </Botao>
        )}
        <form
          action={action}
          onSubmit={(e) => {
            if (!window.confirm("Apagar esta atividade da programação?")) e.preventDefault();
          }}
        >
          <input type="hidden" name="atividade_id" value={a.id} />
          <Botao type="submit" variante="secundario" className="min-h-10 px-3 text-sm" carregando={pendente}>
            Apagar
          </Botao>
        </form>
      </div>
      {estado && !estado.ok && <Aviso tom="alerta">{estado.erro}</Aviso>}
    </li>
  );
}

/** "Sequência · 120 m — Diurno Seg–Sex 60 · Luis / Noturno Seg–Sex 60 · Alberto" */
export function textoSequencia(g: AtividadeProgramada[], responsaveis: ResponsavelRef[]): string {
  const total = g.reduce((s, a) => s + a.meta, 0);
  const partes = g.map((a) => {
    const nome = responsaveis.find((r) => r.id === a.responsavel_id)?.nome;
    return `${a.periodo === "diurno" ? "Diurno" : "Noturno"} ${resumoDias(a.dias)} ${numeroBR(a.meta)}${nome ? ` · ${nome}` : ""}`;
  });
  return `Sequência · ${numeroBR(total)} ${g[0].unidade ?? ""} — ${partes.join(" / ")}`;
}

export function ListaRascunho({
  atividades,
  pendentes,
  saldosAtuais,
  ...comum
}: Comum & { atividades: AtividadeProgramada[]; pendentes: PendenteAnterior[]; saldosAtuais: Record<string, number> }) {
  const { semanaId } = comum;
  const semResponsavel = textoSemResponsavel(contarSemResponsavel(atividades));
  const [estado, action, pendente] = useActionState<EstadoSemana, FormData>(programarSemanaAcao, null);
  // "Duplicar": copia a atividade para o formulário de inclusão (a key remonta o formulário com a cópia).
  // "Continuar no próximo turno" (item 19): a mesma cópia, no turno seguinte e vinculada à original.
  // "Trazer" (item 1.6): cópia da atividade da semana anterior, com meta = saldo e a origem guardada.
  const [copia, setCopia] = useState<{
    atividade: AtividadeProgramada;
    n: number;
    continuaDe: AtividadeProgramada | null;
    trazidaDe: Trazida | null;
  } | null>(null);
  const novaRef = useRef<HTMLDivElement>(null);
  const duplicar = (a: AtividadeProgramada, continuaDe: AtividadeProgramada | null = null, trazidaDe: Trazida | null = null) => {
    setCopia((c) => ({ atividade: a, n: (c?.n ?? 0) + 1, continuaDe, trazidaDe }));
    novaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const continuar = (a: AtividadeProgramada) => {
    const p = proximoTurno(a);
    return p ? () => duplicar({ ...a, ...p }, a) : null;
  };
  const trazidas = new Set(atividades.flatMap((a) => (a.trazida_de ? [a.trazida_de] : [])));
  const trazer = (p: PendenteAnterior) => duplicar({ ...p.origem, meta: p.saldo, continua_de: null }, null, { id: p.origem.id, saldo: p.saldo });
  const item = (a: AtividadeProgramada) => (
    <ItemRascunho
      key={a.id}
      {...comum}
      atividade={a}
      aoDuplicar={() => duplicar(a)}
      aoContinuar={continuar(a)}
      saldoAtual={saldosAtuais[a.id]}
    />
  );
  return (
    <div className="flex flex-col gap-4">
      <NaoConcluidasAnterior pendentes={pendentes} trazidas={trazidas} responsaveis={comum.responsaveis} aoTrazer={trazer} />
      <Cartao className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-primaria">Atividades da semana</h2>
        {atividades.length === 0 ? (
          <p className="text-texto-suave">Nenhuma atividade ainda. Inclua o que a equipe vai se comprometer a entregar.</p>
        ) : (
          <ul className="divide-y divide-borda">
            {agruparSequencias(atividades).map((g) =>
              g.length === 1 ? (
                item(g[0])
              ) : (
                <li key={g[0].id} className="py-3">
                  <p className="text-sm font-semibold text-operacional">{textoSequencia(g, comum.responsaveis)}</p>
                  <ul className="ml-3 divide-y divide-borda border-l-2 border-operacional pl-3">{g.map(item)}</ul>
                </li>
              ),
            )}
          </ul>
        )}
      </Cartao>

      <div ref={novaRef} className="scroll-mt-4">
        <Cartao>
          <h2 className="mb-3 text-lg font-semibold text-primaria">
            {copia?.trazidaDe
              ? "Trazida da semana anterior"
              : copia?.continuaDe
                ? "Próximo turno da sequência"
                : copia
                  ? "Nova atividade (cópia)"
                  : "Nova atividade"}
          </h2>
          <FormAtividadeProgramada
            key={copia ? `copia-${copia.n}` : "nova"}
            {...comum}
            modelo={copia?.atividade}
            continuaDe={copia?.continuaDe ?? undefined}
            trazidaDe={copia?.trazidaDe ?? undefined}
            aoConcluir={copia ? () => setCopia(null) : undefined}
          />
        </Cartao>
      </div>

      <form
        action={action}
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          const n = atividades.length;
          const msg = `Programar a semana com ${n} atividade${n === 1 ? "" : "s"}? Depois disso a lista, as metas e a equipe ficam travadas.`;
          if (!window.confirm(msg)) e.preventDefault();
        }}
      >
        <input type="hidden" name="semana_id" value={semanaId} />
        {semResponsavel && <Aviso tom="info">{semResponsavel}</Aviso>}
        <Botao type="submit" variante="destaque" carregando={pendente}>
          Programar semana
        </Botao>
        <p className="text-sm text-texto-suave">
          Ao programar, a lista, as metas e a equipe ficam travadas e o app guarda a foto oficial do compromisso.
        </p>
        {estado && !estado.ok && <Aviso tom="alerta">{estado.erro}</Aviso>}
      </form>
    </div>
  );
}
