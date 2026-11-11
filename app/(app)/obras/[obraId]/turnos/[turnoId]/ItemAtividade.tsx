"use client";

import { useActionState, useEffect, useState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import type { Atividade } from "@/lib/db/atividades";
import { Selo } from "@/components/ui/Selo";
import { numeroBR } from "@/lib/dominio/formato";
import type { StatusSemana } from "@/lib/dominio/programacao";
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
  confirmar,
  aoErro,
}: {
  acao: (p: EstadoAcao, f: FormData) => Promise<EstadoAcao>;
  atividadeId: string;
  direcao?: "cima" | "baixo";
  rotulo: string;
  children: React.ReactNode;
  variante?: "secundario" | "perigo";
  desabilitado?: boolean;
  confirmar?: string;
  aoErro: (mensagem: string) => void;
}) {
  const [estado, action, pendente] = useActionState<EstadoAcao, FormData>(acao, null);
  useEffect(() => {
    if (estado && !estado.ok) aoErro(estado.erro);
  }, [estado, aoErro]);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      <input type="hidden" name="atividade_id" value={atividadeId} />
      {direcao && <input type="hidden" name="direcao" value={direcao} />}
      <Botao
        type="submit"
        variante={variante}
        aria-label={rotulo}
        disabled={desabilitado || pendente}
        className="min-h-10 px-3 text-sm"
      >
        {children}
      </Botao>
    </form>
  );
}

export function ItemAtividade({
  atividade: a,
  primeira,
  ultima,
  semanaStatus = null,
}: {
  atividade: Atividade;
  primeira: boolean;
  ultima: boolean;
  semanaStatus?: StatusSemana | null;
}) {
  const [editando, setEditando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  if (editando) {
    return (
      <li className="py-3">
        <FormAtividade
          atividade={a}
          acao={async (prev, form) => {
            const r = await editarAtividadeAcao(prev, form);
            if (r?.ok) setEditando(false);
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
        <p className="flex flex-wrap items-center gap-2 font-medium text-texto">
          {a.descricao}
          {a.programacao_atividade_id ? (
            <Selo tom="info">Programada</Selo>
          ) : (
            (semanaStatus === "programada" || semanaStatus === "encerrada") && <Selo tom="alerta">Extra</Selo>
          )}
        </p>
        <p className="text-sm text-texto-suave">
          {a.local ? `${a.local} · ` : ""}
          {numeroBR(a.qtd_planejada)} {a.unidade}
          {a.origem_id ? " · pendente do turno anterior" : ""}
        </p>
      </div>
      {erroAcao && <Aviso tom="perigo">{erroAcao}</Aviso>}
      <div className="flex flex-wrap gap-2">
        <BotaoAcao acao={moverAtividadeAcao} atividadeId={a.id} direcao="cima" rotulo="Subir" desabilitado={primeira} aoErro={setErroAcao}>
          ↑
        </BotaoAcao>
        <BotaoAcao acao={moverAtividadeAcao} atividadeId={a.id} direcao="baixo" rotulo="Descer" desabilitado={ultima} aoErro={setErroAcao}>
          ↓
        </BotaoAcao>
        <Botao type="button" variante="secundario" className="min-h-10 px-3 text-sm" onClick={() => {
            setErroAcao(null);
            setEditando(true);
          }}>
          Editar
        </Botao>
        <BotaoAcao acao={removerAtividadeAcao} atividadeId={a.id} rotulo="Remover" variante="perigo" confirmar="Remover esta atividade?" aoErro={setErroAcao}>
          Remover
        </BotaoAcao>
      </div>
    </li>
  );
}
