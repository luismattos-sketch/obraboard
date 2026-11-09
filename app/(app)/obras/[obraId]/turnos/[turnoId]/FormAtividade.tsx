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
  const erro = estado && !estado.ok ? estado.erro : null;
  return (
    <form action={action} className="flex flex-col gap-3">
      {turnoId && <input type="hidden" name="turno_id" value={turnoId} />}
      {atividade && <input type="hidden" name="atividade_id" value={atividade.id} />}
      <Campo rotulo="Descrição" name="descricao" required defaultValue={atividade?.descricao} />
      <Campo rotulo="Local (opcional)" name="local" defaultValue={atividade?.local ?? ""} />
      <div className="grid grid-cols-2 gap-3">
        <Campo
          rotulo="Quantidade"
          name="qtd_planejada"
          inputMode="decimal"
          required
          defaultValue={atividade ? String(atividade.qtd_planejada).replace(".", ",") : ""}
        />
        <Campo rotulo="Unidade" name="unidade" required placeholder="m², m³, un" defaultValue={atividade?.unidade} />
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
