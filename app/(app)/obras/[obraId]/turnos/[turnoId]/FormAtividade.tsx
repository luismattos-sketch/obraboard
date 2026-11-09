"use client";

import { useActionState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import { Campo } from "@/components/ui/Campo";
import type { Atividade } from "@/lib/db/atividades";
import { adicionarAtividadeAcao, type EstadoAcao } from "./acoes";

type Props = {
  turnoId?: string;
  atividade?: Atividade;
  /** Action de edição; sem ela o formulário adiciona. */
  acao?: (prev: EstadoAcao, form: FormData) => Promise<EstadoAcao>;
  aoCancelar?: () => void;
};

export function FormAtividade({ turnoId, atividade, acao, aoCancelar }: Props) {
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
        <Campo rotulo="Descrição" name="descricao" defaultValue={inicial.descricao} erro={campos?.descricao} />
        <Campo rotulo="Local (opcional)" name="local" defaultValue={inicial.local} />
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Quantidade" name="qtd_planejada" inputMode="decimal" defaultValue={inicial.qtd} erro={campos?.qtd_planejada} />
          <Campo rotulo="Unidade" name="unidade" placeholder="m², m³, un" defaultValue={inicial.unidade} erro={campos?.unidade} />
        </div>
      </div>
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
