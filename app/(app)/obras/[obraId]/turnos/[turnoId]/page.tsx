import Link from "next/link";
import { notFound } from "next/navigation";
import { Selo } from "@/components/ui/Selo";
import { versoesDoTurno } from "@/lib/db/rdo-versoes";
import { obterTurnoCompleto } from "@/lib/db/turnos";
import { formatarData, horaCurta, ROTULO_PERIODO, TOM_STATUS_TURNO } from "@/lib/dominio/formato";
import { ROTULO_STATUS_TURNO } from "@/lib/dominio/tipos";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { Aviso } from "@/components/ui/Aviso";
import { AcoesTurno } from "./AcoesTurno";
import { BlocoRdo } from "./BlocoRdo";
import { DadosTurno } from "./DadosTurno";
import { EdicaoExecucao } from "./EdicaoExecucao";
import { ListaAtividades } from "./ListaAtividades";
import { PainelLink } from "./PainelLink";
import { Resumo } from "./Resumo";

export default async function TurnoPage({ params }: { params: Promise<{ obraId: string; turnoId: string }> }) {
  const { obraId, turnoId } = await params;
  const supabase = await criarClienteServidor();
  const [turno, versoes] = await Promise.all([obterTurnoCompleto(supabase, turnoId), versoesDoTurno(supabase, turnoId)]);
  if (!turno || turno.obra_id !== obraId) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/obras/${obraId}`} className="text-sm text-operacional underline">← {turno.obra.nome}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-titulo font-semibold text-primaria">
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
        <>
          <ListaAtividades turnoId={turno.id} atividades={turno.atividades} />
          <DadosTurno
            turnoId={turno.id}
            data={turno.data}
            periodo={turno.periodo}
            hora_inicio_prevista={turno.hora_inicio_prevista}
            hora_fim_prevista={turno.hora_fim_prevista}
          />
        </>
      ) : (
        <>
          <Resumo turno={turno} />
          <BlocoRdo turnoId={turno.id} fechado={turno.status === "fechado"} versoes={versoes} />
          {turno.status === "fechado" ? (
            <AcoesTurno turnoId={turno.id} fechado />
          ) : (
            <>
              <details className="rounded-cartao border border-borda bg-superficie p-4">
                <summary className="cursor-pointer text-lg font-semibold text-texto">Editar planejamento</summary>
                <div className="mt-3 flex flex-col gap-3">
                  <Aviso tom="info">O encarregado precisa recarregar a página para ver as mudanças.</Aviso>
                  <ListaAtividades turnoId={turno.id} atividades={turno.atividades} trazerPendentes={false} />
                </div>
              </details>
              <EdicaoExecucao
                turnoId={turno.id}
                hora_inicio_real={turno.hora_inicio_real}
                hora_fim_real={turno.hora_fim_real}
                atividades={turno.atividades}
                efetivo={turno.efetivo.map((e) => ({ funcao: e.funcao, quantidade: e.quantidade }))}
                clima={turno.clima}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
