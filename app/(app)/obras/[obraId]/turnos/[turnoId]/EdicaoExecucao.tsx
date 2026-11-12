"use client";

import { BlocoAtividades, useExecucaoLocal } from "@/components/execucao/BlocoAtividades";
import { BlocoClima } from "@/components/execucao/BlocoClima";
import { EfetivoPorEquipe } from "@/components/execucao/EfetivoPorEquipe";
import { ordenarPorResponsavel, type ResponsavelRef } from "@/lib/dominio/quadro";
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
  efetivo: Pick<Efetivo, "funcao" | "quantidade" | "responsavel_id">[];
  clima: Clima[];
  opcoesFuncao: string[];
  obraId: string;
  responsaveis: ResponsavelRef[];
};

/** Correções do planejador: os mesmos blocos do encarregado, ligados às actions do planejador. */
export function EdicaoExecucao({ turnoId, hora_inicio_real, hora_fim_real, atividades, efetivo, clima, opcoesFuncao, obraId, responsaveis }: Props) {
  const agrupar = atividades.some((a) => a.responsavel_id !== null);
  const ordenadas = agrupar ? ordenarPorResponsavel(atividades, responsaveis) : atividades;
  const nomeDe = (id: string | null) => (id === null ? null : (responsaveis.find((r) => r.id === id)?.nome ?? "—"));
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
          atividades={ordenadas}
          grupoDe={agrupar ? (a) => nomeDe(a.responsavel_id) : undefined}
          salvar={(id, d) => corrigirExecucao(turnoId, id, d)}
          onMudar={mudar}
          erros={erros}
        />
        <EfetivoPorEquipe
          obraId={obraId}
          responsaveis={responsaveis}
          efetivo={efetivo}
          opcoesFuncao={opcoesFuncao}
          equipesIniciais={[...new Set(atividades.map((a) => a.responsavel_id))]}
          salvar={(id, l, esperado) => corrigirEfetivo(turnoId, id, l, esperado)}
        />
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
