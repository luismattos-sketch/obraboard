"use client";

import { useState } from "react";
import { MenuResponsavel } from "@/components/responsaveis/MenuResponsavel";
import type { Resultado } from "@/lib/db/resultado";
import type { ResponsavelRef } from "@/lib/dominio/quadro";
import { BlocoEfetivo } from "./BlocoEfetivo";

type LinhaEfetivo = { funcao: string; quantidade: number };
type LinhaComEquipe = LinhaEfetivo & { responsavel_id: string | null };

type Props = {
  obraId: string;
  /** Responsáveis conhecidos (para nomes e para "+ Adicionar equipe"). */
  responsaveis: ResponsavelRef[];
  efetivo: LinhaComEquipe[];
  opcoesFuncao: string[];
  somenteLeitura?: boolean;
  /** Link de campo: sem "+ Adicionar equipe" (criar/escolher equipe é do planejador). */
  adicionarEquipe?: boolean;
  /** Equipes que aparecem mesmo sem efetivo (ex.: responsáveis com atividade no turno). */
  equipesIniciais?: (string | null)[];
  salvar: (responsavelId: string | null, linhas: LinhaEfetivo[], esperado: LinhaEfetivo[]) => Promise<Resultado<unknown>>;
};

/** Efetivo agrupado por responsável: um BlocoEfetivo por equipe, cada um salvo no seu escopo. */
export function EfetivoPorEquipe({
  obraId,
  responsaveis,
  efetivo,
  opcoesFuncao,
  somenteLeitura,
  adicionarEquipe = true,
  equipesIniciais = [],
  salvar,
}: Props) {
  const [extras, setExtras] = useState<string[]>([]);
  const [escolhendo, setEscolhendo] = useState(false);

  const nome = (id: string | null) =>
    id === null ? "Sem responsável" : (responsaveis.find((r) => r.id === id)?.nome ?? "Responsável removido");
  // Planejador: a equipe "Sem responsável" fica sempre disponível (apoio, segurança…).
  const chaves = new Set<string | null>([
    ...(adicionarEquipe ? [null] : []),
    ...equipesIniciais,
    ...efetivo.map((e) => e.responsavel_id),
    ...extras,
  ]);
  const nomeadas = [...chaves].filter((k): k is string => k !== null).sort((a, b) => nome(a).localeCompare(nome(b), "pt-BR"));
  const equipes: (string | null)[] = [...nomeadas, ...(chaves.has(null) ? [null] : [])];

  // Sem nenhuma equipe nomeada: o bloco de sempre (turnos antigos, obras sem responsáveis).
  if (nomeadas.length === 0 && (!adicionarEquipe || responsaveis.length === 0)) {
    return (
      <BlocoEfetivo
        inicial={efetivo.filter((e) => e.responsavel_id === null)}
        opcoes={opcoesFuncao}
        somenteLeitura={somenteLeitura}
        salvar={(l, esperado) => salvar(null, l, esperado)}
      />
    );
  }

  return (
    <section aria-labelledby="titulo-efetivo" className="flex flex-col gap-4">
      <h2 id="titulo-efetivo" className="text-lg font-semibold text-primaria">Efetivo</h2>
      {equipes.map((id) => (
        <BlocoEfetivo
          key={id ?? "sem"}
          equipe={nome(id)}
          inicial={efetivo.filter((e) => e.responsavel_id === id)}
          opcoes={opcoesFuncao}
          somenteLeitura={somenteLeitura}
          salvar={(l, esperado) => salvar(id, l, esperado)}
        />
      ))}
      {!somenteLeitura && adicionarEquipe && (
        escolhendo ? (
          <MenuResponsavel
            obraId={obraId}
            rotulo="Equipe de"
            responsaveis={responsaveis.filter((r) => !chaves.has(r.id))}
            valor={null}
            aoMudar={(id) => {
              if (id && !chaves.has(id)) setExtras((xs) => [...xs, id]);
              setEscolhendo(false);
            }}
          />
        ) : (
          <button
            type="button"
            className="min-h-12 rounded-botao border border-dashed border-operacional bg-superficie font-semibold text-primaria hover:bg-primaria-clara"
            onClick={() => setEscolhendo(true)}
          >
            + Adicionar equipe
          </button>
        )
      )}
    </section>
  );
}
