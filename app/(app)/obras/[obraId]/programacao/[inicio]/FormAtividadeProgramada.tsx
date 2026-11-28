"use client";

import { useActionState, useEffect, useState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import { Campo } from "@/components/ui/Campo";
import { parseNumero } from "@/lib/dominio/entrada";
import { numeroBR } from "@/lib/dominio/formato";
import { ROTULO_DIAS, sugestaoDoDia, type AtividadeProgramada, type DiaSemana } from "@/lib/dominio/programacao";
import type { Periodo } from "@/lib/dominio/tipos";
import { EditorEquipe, type LinhaEquipe } from "@/components/execucao/EditorEquipe";
import { MenuResponsavel } from "@/components/responsaveis/MenuResponsavel";
import type { ResponsavelRef } from "@/lib/dominio/quadro";
import { salvarAtividadeProgramadaAcao, type EstadoSemana } from "./acoes";


export function FormAtividadeProgramada({
  semanaId,
  obraId,
  responsaveis,
  atividade,
  modelo,
  continuaDe,
  trazidaDe,
  cronogramaItem,
  sugestoesFuncao,
  aoConcluir,
}: {
  semanaId: string;
  obraId: string;
  responsaveis: ResponsavelRef[];
  atividade?: AtividadeProgramada;
  /** Inclusão a partir de uma cópia ("Duplicar"): preenche tudo, mas cria uma atividade nova. */
  modelo?: AtividadeProgramada;
  /** "Continuar no próximo turno": a nova atividade fica vinculada a esta (o saldo segue). */
  continuaDe?: AtividadeProgramada;
  /** "Trazer" da semana anterior (item 1.6): guarda a origem e o saldo de agora. */
  trazidaDe?: { id: string; saldo: number };
  /** "Levar para esta semana" do lookahead (item 5.1): guarda de qual item do cronograma veio. */
  cronogramaItem?: { id: string; codigo: string | null };
  /** Funções já usadas na obra + padrão (evita duas grafias da mesma função). */
  sugestoesFuncao: string[];
  /** Chamado após salvar (edição) ou ao cancelar. */
  aoConcluir?: () => void;
}) {
  const base = atividade ?? modelo;
  const [descricao, setDescricao] = useState(base?.descricao ?? "");
  const [local, setLocal] = useState(base?.local ?? "");
  const [unidade, setUnidade] = useState(base?.unidade ?? "");
  const [meta, setMeta] = useState(base && base.meta > 0 ? String(base.meta).replace(".", ",") : "");
  const [dias, setDias] = useState<DiaSemana[]>(base?.dias ?? []);
  const [periodo, setPeriodo] = useState<Periodo>(base?.periodo ?? "diurno");
  const [responsavel, setResponsavel] = useState<string | null>(base?.responsavel_id ?? null);
  const [equipe, setEquipe] = useState<LinhaEquipe[]>(
    base?.equipe.length
      ? base.equipe.map((e) => ({ funcao: e.funcao, quantidade: String(e.quantidade) }))
      : [{ funcao: "", quantidade: "" }],
  );

  // Inclusão: ao salvar, limpa só descrição e meta; local, dias, período, responsável e equipe ficam
  // para a próxima atividade (menos cliques ao programar a semana).
  const [estado, action, pendente] = useActionState<EstadoSemana, FormData>(async (anterior, form) => {
    const r = await salvarAtividadeProgramadaAcao(anterior, form);
    if (r?.ok && !atividade) {
      setDescricao("");
      setMeta("");
    }
    return r;
  }, null);

  // Edição e próximo turno da sequência: fecha o formulário ao salvar.
  useEffect(() => {
    if (estado?.ok && (atividade || continuaDe || trazidaDe || cronogramaItem)) aoConcluir?.();
  }, [estado, atividade, continuaDe, trazidaDe, cronogramaItem, aoConcluir]);

  const falhou = estado && !estado.ok ? estado : null;
  const campos = falhou?.campos;
  const metaNum = parseNumero(meta);
  const primeiro = [...dias].sort((a, b) => a - b)[0];
  const previa =
    metaNum !== null && metaNum > 0 && dias.length > 1 && primeiro !== undefined
      ? sugestaoDoDia({ meta: metaNum, dias }, primeiro, 0)
      : null;
  const alternarDia = (d: DiaSemana) => setDias((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="semana_id" value={semanaId} />
      {atividade && <input type="hidden" name="atividade_id" value={atividade.id} />}
      {continuaDe && (
        <>
          <input type="hidden" name="continua_de" value={continuaDe.id} />
          <Aviso tom="info">
            Continua de “{continuaDe.descricao}” ({continuaDe.periodo === "diurno" ? "diurno" : "noturno"}). O que faltar ou sobrar
            no turno anterior passa para este. Troque o responsável e a equipe se for outra turma.
          </Aviso>
        </>
      )}
      {cronogramaItem && (
        <>
          <input type="hidden" name="cronograma_item_id" value={cronogramaItem.id} />
          <Aviso tom="info">
            Do lookahead{cronogramaItem.codigo ? ` (código ${cronogramaItem.codigo})` : ""}. Ajuste a meta, os dias, o responsável e a
            equipe para o que cabe nesta semana. Para quebrar em partes, leve o item de novo.
          </Aviso>
        </>
      )}
      {trazidaDe && (
        <>
          <input type="hidden" name="trazida_de" value={trazidaDe.id} />
          <input type="hidden" name="saldo_trazido" value={String(trazidaDe.saldo).replace(".", ",")} />
          <Aviso tom="info">
            Trazida da semana anterior com o saldo de agora. Ajuste os dias, o responsável e a meta se precisar.
          </Aviso>
        </>
      )}
      <Campo rotulo="Descrição" name="descricao" maxLength={200} value={descricao} onChange={(e) => setDescricao(e.target.value)} erro={campos?.descricao} />
      <Campo rotulo="Local (opcional)" name="local" maxLength={100} value={local} onChange={(e) => setLocal(e.target.value)} erro={campos?.local} />
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Meta da semana" name="meta" inputMode="decimal" value={meta} onChange={(e) => setMeta(e.target.value)} erro={campos?.meta} />
        <Campo rotulo="Unidade" name="unidade" placeholder="m, m², un" maxLength={20} value={unidade} onChange={(e) => setUnidade(e.target.value)} erro={campos?.unidade} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-texto">Dias</legend>
        <div className="flex flex-wrap gap-2">
          {ROTULO_DIAS.map((rotulo, i) => {
            const d = i as DiaSemana;
            const marcado = dias.includes(d);
            return (
              <label
                key={rotulo}
                className={`inline-flex min-h-10 cursor-pointer items-center rounded-full border px-3 text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-operacional ${
                  marcado ? "border-operacional bg-operacional text-white" : "border-borda bg-superficie text-primaria"
                }`}
              >
                <input type="checkbox" name="dias" value={i} checked={marcado} onChange={() => alternarDia(d)} className="sr-only" />
                {rotulo}
              </label>
            );
          })}
        </div>
        {campos?.dias && <p className="text-sm text-perigo">{campos.dias}</p>}
        {previa !== null && (
          <p className="text-sm text-texto-suave">
            ≈ {numeroBR(previa)} {unidade || "un"}/dia
          </p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium text-texto">Período</legend>
        <div className="flex gap-4">
          {(["diurno", "noturno"] as const).map((p) => (
            <label key={p} className="inline-flex min-h-10 items-center gap-2 text-base">
              <input type="radio" name="periodo" value={p} checked={periodo === p} onChange={() => setPeriodo(p)} />
              {p === "diurno" ? "Diurno" : "Noturno"}
            </label>
          ))}
        </div>
      </fieldset>

      <input type="hidden" name="responsavel_id" value={responsavel ?? ""} />
      <MenuResponsavel obraId={obraId} responsaveis={responsaveis} valor={responsavel} aoMudar={setResponsavel} />

      <EditorEquipe linhas={equipe} aoMudar={setEquipe} sugestoes={sugestoesFuncao} erro={campos?.equipe} />

      {falhou && !falhou.campos && <Aviso tom="perigo">{falhou.erro}</Aviso>}
      <div className="flex gap-2">
        <Botao type="submit" carregando={pendente}>
          {atividade ? "Salvar" : "Adicionar atividade"}
        </Botao>
        {aoConcluir && (atividade || modelo) && (
          <Botao type="button" variante="secundario" onClick={aoConcluir}>
            Cancelar
          </Botao>
        )}
      </div>
    </form>
  );
}
