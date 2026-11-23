"use client";

import { useState } from "react";
import { MenuResponsavel } from "@/components/responsaveis/MenuResponsavel";
import type { Resultado } from "@/lib/db/resultado";
import type { ResponsavelRef } from "@/lib/dominio/quadro";
import { Aviso } from "@/components/ui/Aviso";
import { calcularHH, type Janela, type Ocorrencia } from "@/lib/dominio/efetivoHH";
import { BlocoEfetivo } from "./BlocoEfetivo";
import { OcorrenciasEfetivo } from "./OcorrenciasEfetivo";
import { useOcorrencias, type AcoesOcorrencias } from "./useOcorrencias";

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
  /** Equipe prevista por responsável (soma das atividades), mostrada enquanto a equipe não tem efetivo gravado. */
  previsto?: Map<string | null, LinhaEfetivo[]>;
  salvar: (responsavelId: string | null, linhas: LinhaEfetivo[], esperado: LinhaEfetivo[]) => Promise<Resultado<unknown>>;
  /** Empréstimo, saída antes e parados (turno em andamento). Ausente = só as linhas de efetivo. */
  movimentacoes?: AcoesOcorrencias & {
    ocorrencias: Ocorrencia[];
    /** Efetivo de todas as equipes, para a conta de HH (o link de campo mostra só a própria). */
    efetivoTodo?: LinhaComEquipe[];
    janela: Janela | null;
    intervalo: Janela | null;
    /** Estado das ocorrências criado pelo pai (compartilhado com o painel de paradas). */
    estado?: ReturnType<typeof useOcorrencias>;
    /** "HH:MM" para a conta ao vivo das paradas abertas. */
    agora?: string;
  };
};

const SEM_ACOES: AcoesOcorrencias = {
  criar: async () => ({ ok: true, dados: undefined }),
  remover: async () => ({ ok: true, dados: undefined }),
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
  previsto,
  salvar: salvarLinhas,
  movimentacoes,
}: Props) {
  const [extras, setExtras] = useState<string[]>([]);
  const [escolhendo, setEscolhendo] = useState(false);
  const interno = useOcorrencias(movimentacoes?.ocorrencias ?? [], movimentacoes ?? SEM_ACOES);
  const mov = movimentacoes?.estado ?? interno;
  const hh = movimentacoes
    ? calcularHH({
        efetivo: movimentacoes.efetivoTodo ?? efetivo,
        ocorrencias: mov.lista,
        janela: movimentacoes.janela,
        intervalo: movimentacoes.intervalo,
        agora: movimentacoes.agora,
      })
    : null;
  // Com movimentações, as funções da equipe vêm do servidor: atualiza depois de gravar o efetivo.
  const salvar: Props["salvar"] = async (id, l, esperado) => {
    const r = await salvarLinhas(id, l, esperado);
    if (r.ok) movimentacoes?.atualizar?.();
    return r;
  };

  const nome = (id: string | null) =>
    id === null ? "Sem responsável" : (responsaveis.find((r) => r.id === id)?.nome ?? "Responsável removido");
  // Planejador: a equipe "Sem responsável" fica sempre disponível (apoio, segurança…).
  const chaves = new Set<string | null>([
    ...(adicionarEquipe ? [null] : []),
    ...equipesIniciais,
    // Link de campo mostra só a própria equipe (equipesIniciais); o planejador vê todas as com previsto.
    ...(adicionarEquipe && previsto ? [...previsto.keys()] : []),
    ...efetivo.map((e) => e.responsavel_id),
    ...extras,
    // Planejador: equipe que só recebeu empréstimo também aparece.
    ...(adicionarEquipe && hh ? hh.equipes.filter((e) => e.recebidos.length > 0).map((e) => e.responsavel_id) : []),
  ]);
  const movDe = (id: string | null) =>
    movimentacoes && (
      <OcorrenciasEfetivo
        responsavelId={id}
        funcoes={[...new Set(efetivo.filter((e) => e.responsavel_id === id).map((e) => e.funcao))]}
        ocorrencias={mov.lista}
        destinos={responsaveis}
        nome={nome}
        resumo={hh?.equipes.find((e) => e.responsavel_id === id) ?? null}
        somenteLeitura={somenteLeitura}
        criar={(d, foto) => mov.criar(id, d, foto ?? null)}
        remover={mov.remover}
      />
    );
  const erroMov = mov.erro && <Aviso tom="alerta">{mov.erro}</Aviso>;
  const nomeadas = [...chaves].filter((k): k is string => k !== null).sort((a, b) => nome(a).localeCompare(nome(b), "pt-BR"));
  const equipes: (string | null)[] = [...nomeadas, ...(chaves.has(null) ? [null] : [])];

  // Sem nenhuma equipe nomeada: o bloco de sempre (turnos antigos, obras sem responsáveis).
  if (nomeadas.length === 0 && (!adicionarEquipe || responsaveis.length === 0)) {
    const unico = (
      <BlocoEfetivo
        inicial={efetivo.filter((e) => e.responsavel_id === null)}
        previsto={previsto?.get(null)}
        opcoes={opcoesFuncao}
        somenteLeitura={somenteLeitura}
        salvar={(l, esperado) => salvar(null, l, esperado)}
      />
    );
    if (!movimentacoes) return unico;
    return (
      <div className="flex flex-col gap-3">
        {unico}
        {movDe(null)}
        {erroMov}
      </div>
    );
  }

  return (
    <section aria-labelledby="titulo-efetivo" className="flex flex-col gap-4">
      <h2 id="titulo-efetivo" className="text-lg font-semibold text-primaria">Efetivo</h2>
      {equipes.map((id) => (
        <div key={id ?? "sem"} className="flex flex-col gap-2">
          <BlocoEfetivo
            equipe={nome(id)}
            inicial={efetivo.filter((e) => e.responsavel_id === id)}
            previsto={previsto?.get(id)}
            opcoes={opcoesFuncao}
            somenteLeitura={somenteLeitura}
            salvar={(l, esperado) => salvar(id, l, esperado)}
          />
          {movDe(id)}
        </div>
      ))}
      {erroMov}
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
