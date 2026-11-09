"use client";

import { useActionState, useState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import type { Atividade } from "@/lib/db/atividades";
import { numeroBR } from "@/lib/dominio/formato";
import {
  editarAtividadeAcao,
  moverAtividadeAcao,
  removerAtividadeAcao,
  type EstadoAcao,
} from "./acoes";
import { FormAtividade } from "./FormAtividade";

function BotaoAcao({
  acao,
  atividadeId,
  direcao,
  rotulo,
  children,
  variante = "secundario",
  desabilitado,
}: {
  acao: (p: EstadoAcao, f: FormData) => Promise<EstadoAcao>;
  atividadeId: string;
  direcao?: "cima" | "baixo";
  rotulo: string;
  children: React.ReactNode;
  variante?: "secundario" | "perigo";
  desabilitado?: boolean;
}) {
  const [estado, action, pendente] = useActionState<EstadoAcao, FormData>(acao, null);
  return (
    <form action={action}>
      <input type="hidden" name="atividade_id" value={atividadeId} />
      {direcao && <input type="hidden" name="direcao" value={direcao} />}
      <Botao
        type="submit"
        variante={variante}
        aria-label={rotulo}
        title={estado && !estado.ok ? estado.erro : rotulo}
        disabled={desabilitado || pendente}
        className="min-h-10 px-3 text-sm"
      >
        {children}
      </Botao>
      {estado && !estado.ok && <span role="alert" className="sr-only">{estado.erro}</span>}
    </form>
  );
}

export function ItemAtividade({
  atividade: a,
  primeira,
  ultima,
}: {
  atividade: Atividade;
  primeira: boolean;
  ultima: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [estadoEdicao, setEstadoEdicao] = useState<EstadoAcao>(null);

  if (editando) {
    return (
      <li className="py-3">
        <FormAtividade
          atividade={a}
          acao={async (prev, form) => {
            const r = await editarAtividadeAcao(prev, form);
            if (r?.ok) setEditando(false);
            setEstadoEdicao(r);
            return r;
          }}
          aoCancelar={() => setEditando(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 py-3">
      <div>
        <p className="font-medium text-texto">{a.descricao}</p>
        <p className="text-sm text-texto-suave">
          {a.local ? `${a.local} · ` : ""}
          {numeroBR(a.qtd_planejada)} {a.unidade}
          {a.origem_id ? " · pendente do turno anterior" : ""}
        </p>
      </div>
      {estadoEdicao && !estadoEdicao.ok && <Aviso tom="perigo">{estadoEdicao.erro}</Aviso>}
      <div className="flex flex-wrap gap-2">
        <BotaoAcao acao={moverAtividadeAcao} atividadeId={a.id} direcao="cima" rotulo="Subir" desabilitado={primeira}>
          ↑
        </BotaoAcao>
        <BotaoAcao acao={moverAtividadeAcao} atividadeId={a.id} direcao="baixo" rotulo="Descer" desabilitado={ultima}>
          ↓
        </BotaoAcao>
        <Botao type="button" variante="secundario" className="min-h-10 px-3 text-sm" onClick={() => setEditando(true)}>
          Editar
        </Botao>
        <BotaoAcao acao={removerAtividadeAcao} atividadeId={a.id} rotulo="Remover" variante="perigo">
          Remover
        </BotaoAcao>
      </div>
    </li>
  );
}
