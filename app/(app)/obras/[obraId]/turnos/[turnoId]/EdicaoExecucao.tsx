"use client";

import { BlocoAtividades, useExecucaoLocal } from "@/components/execucao/BlocoAtividades";
import { BlocoClima } from "@/components/execucao/BlocoClima";
import { BlocoEfetivo } from "@/components/execucao/BlocoEfetivo";
import { BlocoHorario } from "@/components/execucao/BlocoHorario";
import { ProvedorSalvamento, useRastreioSalvamento } from "@/components/execucao/rastreioSalvamento";
import { Aviso } from "@/components/ui/Aviso";
import type { Atividade } from "@/lib/db/atividades";
import type { Clima, Efetivo } from "@/lib/db/turnos";
import { errosDeCausa } from "@/lib/dominio/regras";
import { horaCurta } from "@/lib/dominio/formato";
import { AcoesTurno } from "./AcoesTurno";
import { corrigirClima, corrigirEfetivo, corrigirExecucao, corrigirHorario, limparClimaPlanejador } from "./acoesExecucao";

type Props = {
  turnoId: string;
  hora_inicio_real: string | null;
  hora_fim_real: string | null;
  atividades: Atividade[];
  efetivo: Pick<Efetivo, "funcao" | "quantidade">[];
  clima: Clima[];
};

/** Correções do planejador: os mesmos blocos do encarregado, ligados às actions do planejador. */
export function EdicaoExecucao({ turnoId, hora_inicio_real, hora_fim_real, atividades, efetivo, clima }: Props) {
  const { ocupado, registrar } = useRastreioSalvamento();
  const { lista, mudar } = useExecucaoLocal(atividades);
  const erros = errosDeCausa(lista);
  const pendentes = lista.filter((a) => erros[a.id]);

  return (
    <ProvedorSalvamento registrar={registrar}>
      <section aria-labelledby="titulo-correcao" className="flex min-w-0 flex-col gap-6">
        <div>
          <h2 id="titulo-correcao" className="text-lg font-semibold text-primaria">Corrigir execução</h2>
          <p className="text-sm text-texto-suave">As alterações são salvas automaticamente e atualizam o resumo.</p>
        </div>
        <BlocoHorario
          inicio={horaCurta(hora_inicio_real)}
          fim={horaCurta(hora_fim_real)}
          salvar={(d) => corrigirHorario(turnoId, d)}
        />
        <BlocoAtividades
          atividades={atividades}
          salvar={(id, d) => corrigirExecucao(turnoId, id, d)}
          onMudar={mudar}
          erros={erros}
        />
        <BlocoEfetivo inicial={efetivo} salvar={(l, esperado) => corrigirEfetivo(turnoId, l, esperado)} />
        <BlocoClima
          inicial={clima}
          salvar={(d) => corrigirClima(turnoId, d)}
          limpar={(p) => limparClimaPlanejador(turnoId, p)}
        />
        {pendentes.length > 0 && (
          <Aviso tom="alerta">
            <p className="font-medium">Falta informar a causa em:</p>
            <ul className="list-disc pl-5">
              {pendentes.map((a) => (
                <li key={a.id}>{a.descricao}</li>
              ))}
            </ul>
          </Aviso>
        )}
        <AcoesTurno turnoId={turnoId} fechado={false} salvando={ocupado} />
      </section>
    </ProvedorSalvamento>
  );
}
