"use client";

import { useActionState, useState } from "react";
import { EditorEquipe, LINHA_VAZIA, type LinhaEquipe } from "@/components/execucao/EditorEquipe";
import { MenuResponsavel } from "@/components/responsaveis/MenuResponsavel";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import { Campo } from "@/components/ui/Campo";
import type { Atividade } from "@/lib/db/atividades";
import type { ResponsavelRef } from "@/lib/dominio/quadro";
import { adicionarAtividadeAcao, type EstadoAcao } from "./acoes";

type Props = {
  turnoId?: string;
  atividade?: Atividade;
  /** Action de edição; sem ela o formulário adiciona. */
  acao?: (prev: EstadoAcao, form: FormData) => Promise<EstadoAcao>;
  aoCancelar?: () => void;
  /** Inclusão no turno: Responsável (obrigatório) e Equipe prevista. */
  obraId?: string;
  responsaveis?: ResponsavelRef[];
  sugestoesFuncao?: string[];
};

export function FormAtividade({ turnoId, atividade, acao, aoCancelar, obraId, responsaveis, sugestoesFuncao = [] }: Props) {
  const [responsavel, setResponsavel] = useState<string | null>(null);
  const [equipe, setEquipe] = useState<LinhaEquipe[]>([LINHA_VAZIA]);
  const comEquipe = !atividade && obraId !== undefined && responsaveis !== undefined;
  const [estado, action, pendente] = useActionState<EstadoAcao, FormData>(acao ?? adicionarAtividadeAcao, null);
  const falhou = estado && !estado.ok ? estado : null;
  const erro = falhou && !falhou.campos ? falhou.erro : null;
  const campos = falhou?.campos;
  const v = falhou?.valores;
  const inicial = {
    descricao: v?.descricao ?? atividade?.descricao ?? "",
    local: v?.local ?? atividade?.local ?? "",
    qtd: v?.qtd_planejada ?? (atividade ? String(atividade.qtd_planejada).replace(".", ",") : ""),
    unidade: v?.unidade ?? atividade?.unidade ?? "",
  };
  return (
    <form action={action} className="flex flex-col gap-3">
      {turnoId && <input type="hidden" name="turno_id" value={turnoId} />}
      {atividade && <input type="hidden" name="atividade_id" value={atividade.id} />}
      {/* key muda a cada envio com falha: remonta os campos com os valores devolvidos */}
      <div key={falhou?.envio ?? 0} className="flex flex-col gap-3">
        <Campo rotulo="Descrição" name="descricao" maxLength={200} defaultValue={inicial.descricao} erro={campos?.descricao} />
        <Campo rotulo="Local (opcional)" name="local" maxLength={100} defaultValue={inicial.local} erro={campos?.local} />
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Quantidade" name="qtd_planejada" inputMode="decimal" defaultValue={inicial.qtd} erro={campos?.qtd_planejada} />
          <Campo rotulo="Unidade" name="unidade" placeholder="m², m³, un" maxLength={20} defaultValue={inicial.unidade} erro={campos?.unidade} />
        </div>
      </div>
      {comEquipe && (
        <>
          <input type="hidden" name="responsavel_id" value={responsavel ?? ""} />
          <MenuResponsavel obraId={obraId} responsaveis={responsaveis} valor={responsavel} aoMudar={setResponsavel} />
          {campos?.responsavel_id && <p className="-mt-2 text-sm text-perigo">{campos.responsavel_id}</p>}
          <EditorEquipe linhas={equipe} aoMudar={setEquipe} sugestoes={sugestoesFuncao} erro={campos?.equipe} />
        </>
      )}
      {erro && <Aviso tom="perigo">{erro}</Aviso>}
      <div className="flex gap-2">
        <Botao type="submit" carregando={pendente}>{atividade ? "Salvar" : "Adicionar atividade"}</Botao>
        {aoCancelar && (
          <Botao type="button" variante="secundario" onClick={aoCancelar}>Cancelar</Botao>
        )}
      </div>
    </form>
  );
}
