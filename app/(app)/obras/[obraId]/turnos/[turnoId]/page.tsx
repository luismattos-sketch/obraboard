import Link from "next/link";
import { notFound } from "next/navigation";
import { Selo } from "@/components/ui/Selo";
import { obterTurnoCompleto } from "@/lib/db/turnos";
import { formatarData, horaCurta, ROTULO_PERIODO, TOM_STATUS_TURNO } from "@/lib/dominio/formato";
import { ROTULO_STATUS_TURNO } from "@/lib/dominio/tipos";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { AcoesTurno } from "./AcoesTurno";
import { EdicaoExecucao } from "./EdicaoExecucao";
import { ListaAtividades } from "./ListaAtividades";
import { PainelLink } from "./PainelLink";
import { Resumo } from "./Resumo";

export default async function TurnoPage({ params }: { params: Promise<{ obraId: string; turnoId: string }> }) {
  const { obraId, turnoId } = await params;
  const turno = await obterTurnoCompleto(await criarClienteServidor(), turnoId);
  if (!turno || turno.obra_id !== obraId) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/obras/${obraId}`} className="text-sm text-primaria underline">← {turno.obra.nome}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-primaria">
          Turno {ROTULO_PERIODO[turno.periodo].toLowerCase()} de {formatarData(turno.data)}
        </h1>
        <Selo tom={TOM_STATUS_TURNO[turno.status]}>{ROTULO_STATUS_TURNO[turno.status]}</Selo>
      </div>
      {turno.hora_inicio_prevista && turno.hora_fim_prevista && (
        <p className="text-sm text-texto-suave">
          Previsto: {horaCurta(turno.hora_inicio_prevista)} às {horaCurta(turno.hora_fim_prevista)}
        </p>
      )}

      <PainelLink
        turnoId={turno.id}
        obraNome={turno.obra.nome}
        data={turno.data}
        periodo={ROTULO_PERIODO[turno.periodo].toLowerCase()}
        status={turno.status}
      />

      {turno.status === "planejado" ? (
        <ListaAtividades turnoId={turno.id} atividades={turno.atividades} />
      ) : (
        <>
          <Resumo turno={turno} />
          {turno.status === "fechado" ? (
            <AcoesTurno turnoId={turno.id} fechado />
          ) : (
            <EdicaoExecucao
              turnoId={turno.id}
              hora_inicio_real={turno.hora_inicio_real}
              hora_fim_real={turno.hora_fim_real}
              atividades={turno.atividades}
              efetivo={turno.efetivo.map((e) => ({ funcao: e.funcao, quantidade: e.quantidade }))}
              clima={turno.clima}
            />
          )}
        </>
      )}
    </div>
  );
}
