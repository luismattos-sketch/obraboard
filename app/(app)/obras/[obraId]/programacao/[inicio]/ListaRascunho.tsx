"use client";

import { useActionState, useState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { numeroBR } from "@/lib/dominio/formato";
import { resumoDias, resumoEquipe, type AtividadeProgramada } from "@/lib/dominio/programacao";
import { programarSemanaAcao, removerAtividadeProgramadaAcao, type EstadoSemana } from "./acoes";
import { FormAtividadeProgramada } from "./FormAtividadeProgramada";

function ItemRascunho({ semanaId, atividade: a, sugestoesFuncao }: { semanaId: string; atividade: AtividadeProgramada; sugestoesFuncao: string[] }) {
  const [editando, setEditando] = useState(false);
  const [estado, action, pendente] = useActionState<EstadoSemana, FormData>(removerAtividadeProgramadaAcao, null);
  if (editando) {
    return (
      <li className="py-3">
        <FormAtividadeProgramada semanaId={semanaId} atividade={a} sugestoesFuncao={sugestoesFuncao} aoConcluir={() => setEditando(false)} />
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
      </div>
      <div className="flex gap-2">
        <Botao type="button" variante="secundario" className="min-h-10 px-3 text-sm" onClick={() => setEditando(true)}>
          Editar
        </Botao>
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

export function ListaRascunho({
  semanaId,
  atividades,
  sugestoesFuncao,
}: {
  semanaId: string;
  atividades: AtividadeProgramada[];
  sugestoesFuncao: string[];
}) {
  const [estado, action, pendente] = useActionState<EstadoSemana, FormData>(programarSemanaAcao, null);
  return (
    <div className="flex flex-col gap-4">
      <Cartao className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-primaria">Atividades da semana</h2>
        {atividades.length === 0 ? (
          <p className="text-texto-suave">Nenhuma atividade ainda. Inclua o que a equipe vai se comprometer a entregar.</p>
        ) : (
          <ul className="divide-y divide-borda">
            {atividades.map((a) => (
              <ItemRascunho key={a.id} semanaId={semanaId} atividade={a} sugestoesFuncao={sugestoesFuncao} />
            ))}
          </ul>
        )}
      </Cartao>

      <Cartao>
        <h2 className="mb-3 text-lg font-semibold text-primaria">Nova atividade</h2>
        <FormAtividadeProgramada key={atividades.length} semanaId={semanaId} sugestoesFuncao={sugestoesFuncao} />
      </Cartao>

      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="semana_id" value={semanaId} />
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
