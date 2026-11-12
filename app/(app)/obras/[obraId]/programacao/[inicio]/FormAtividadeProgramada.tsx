"use client";

import { useActionState, useEffect, useState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import { Campo } from "@/components/ui/Campo";
import { parseNumero } from "@/lib/dominio/entrada";
import { numeroBR } from "@/lib/dominio/formato";
import { canonizarFuncao, ROTULO_DIAS, sugestaoDoDia, type AtividadeProgramada, type DiaSemana } from "@/lib/dominio/programacao";
import type { Periodo } from "@/lib/dominio/tipos";
import { MenuResponsavel } from "@/components/responsaveis/MenuResponsavel";
import type { ResponsavelRef } from "@/lib/dominio/quadro";
import { salvarAtividadeProgramadaAcao, type EstadoSemana } from "./acoes";

type Linha = { funcao: string; quantidade: string };

export function FormAtividadeProgramada({
  semanaId,
  obraId,
  responsaveis,
  atividade,
  sugestoesFuncao,
  aoConcluir,
}: {
  semanaId: string;
  obraId: string;
  responsaveis: ResponsavelRef[];
  atividade?: AtividadeProgramada;
  /** Funções já usadas na obra + padrão (evita duas grafias da mesma função). */
  sugestoesFuncao: string[];
  /** Chamado após salvar (edição) ou ao cancelar. */
  aoConcluir?: () => void;
}) {
  const [estado, action, pendente] = useActionState<EstadoSemana, FormData>(salvarAtividadeProgramadaAcao, null);
  const [descricao, setDescricao] = useState(atividade?.descricao ?? "");
  const [local, setLocal] = useState(atividade?.local ?? "");
  const [unidade, setUnidade] = useState(atividade?.unidade ?? "");
  const [meta, setMeta] = useState(atividade ? String(atividade.meta).replace(".", ",") : "");
  const [dias, setDias] = useState<DiaSemana[]>(atividade?.dias ?? []);
  const [periodo, setPeriodo] = useState<Periodo>(atividade?.periodo ?? "diurno");
  const [responsavel, setResponsavel] = useState<string | null>(atividade?.responsavel_id ?? null);
  const [equipe, setEquipe] = useState<Linha[]>(
    atividade?.equipe.length
      ? atividade.equipe.map((e) => ({ funcao: e.funcao, quantidade: String(e.quantidade) }))
      : [{ funcao: "", quantidade: "" }],
  );

  // Edição: fecha o formulário ao salvar. Inclusão: o pai remonta o formulário (key) quando a lista cresce.
  useEffect(() => {
    if (estado?.ok && atividade) aoConcluir?.();
  }, [estado, atividade, aoConcluir]);

  const falhou = estado && !estado.ok ? estado : null;
  const campos = falhou?.campos;
  const metaNum = parseNumero(meta);
  const primeiro = [...dias].sort((a, b) => a - b)[0];
  const previa =
    metaNum !== null && metaNum > 0 && dias.length > 1 && primeiro !== undefined
      ? sugestaoDoDia({ meta: metaNum, dias }, primeiro, 0)
      : null;
  const alternarDia = (d: DiaSemana) => setDias((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));
  const mudarLinha = (i: number, campo: keyof Linha, valor: string) =>
    setEquipe((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="semana_id" value={semanaId} />
      {atividade && <input type="hidden" name="atividade_id" value={atividade.id} />}
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

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-texto">Equipe prevista</legend>
        <datalist id="funcoes-sugeridas">
          {sugestoesFuncao.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
        {equipe.map((l, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Campo rotulo="Função" name="funcao" list="funcoes-sugeridas" maxLength={60} value={l.funcao} onChange={(e) => mudarLinha(i, "funcao", e.target.value)} onBlur={() => mudarLinha(i, "funcao", canonizarFuncao(l.funcao, sugestoesFuncao))} />
            </div>
            <div className="w-24">
              <Campo rotulo="Qtd" name="quantidade" inputMode="numeric" value={l.quantidade} onChange={(e) => mudarLinha(i, "quantidade", e.target.value)} />
            </div>
            <Botao
              type="button"
              variante="secundario"
              className="min-h-12 px-3 text-sm"
              aria-label={`Remover função ${l.funcao || i + 1}`}
              onClick={() => setEquipe((ls) => (ls.length === 1 ? [{ funcao: "", quantidade: "" }] : ls.filter((_, j) => j !== i)))}
            >
              Remover
            </Botao>
          </div>
        ))}
        {campos?.equipe && <p className="text-sm text-perigo">{campos.equipe}</p>}
        <div>
          <Botao type="button" variante="secundario" className="min-h-10 px-3 text-sm" onClick={() => setEquipe((ls) => [...ls, { funcao: "", quantidade: "" }])}>
            Adicionar função
          </Botao>
        </div>
      </fieldset>

      {falhou && !falhou.campos && <Aviso tom="perigo">{falhou.erro}</Aviso>}
      <div className="flex gap-2">
        <Botao type="submit" carregando={pendente}>
          {atividade ? "Salvar" : "Adicionar atividade"}
        </Botao>
        {atividade && aoConcluir && (
          <Botao type="button" variante="secundario" onClick={aoConcluir}>
            Cancelar
          </Botao>
        )}
      </div>
    </form>
  );
}
