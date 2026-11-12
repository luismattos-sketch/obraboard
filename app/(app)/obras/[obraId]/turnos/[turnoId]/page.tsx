import Link from "next/link";
import { notFound } from "next/navigation";
import { Selo } from "@/components/ui/Selo";
import { listarEventos } from "@/lib/db/eventos";
import { opcoesFuncaoDoTurno, semanaDoTurno } from "@/lib/db/programacao";
import { versoesDoTurno } from "@/lib/db/rdo-versoes";
import { listarResponsaveis } from "@/lib/db/responsaveis";
import { classesBotao } from "@/components/ui/Botao";
import { obterTurnoCompleto } from "@/lib/db/turnos";
import { formatarData, horaCurta, ROTULO_PERIODO, TOM_STATUS_TURNO } from "@/lib/dominio/formato";
import { FUNCOES_SUGERIDAS, ROTULO_STATUS_TURNO } from "@/lib/dominio/tipos";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { Aviso } from "@/components/ui/Aviso";
import { AcoesTurno } from "./AcoesTurno";
import { BlocoRdo } from "./BlocoRdo";
import { DadosTurno } from "./DadosTurno";
import { EfetivoTurno } from "./EfetivoTurno";
import { HistoricoTurno } from "./HistoricoTurno";
import { EdicaoExecucao } from "./EdicaoExecucao";
import { ListaAtividades } from "./ListaAtividades";
import { PainelLink } from "./PainelLink";
import { Resumo } from "./Resumo";

export default async function TurnoPage({ params }: { params: Promise<{ obraId: string; turnoId: string }> }) {
  const { obraId, turnoId } = await params;
  const supabase = await criarClienteServidor();
  const [turno, versoes, eventos] = await Promise.all([
    obterTurnoCompleto(supabase, turnoId),
    versoesDoTurno(supabase, turnoId),
    listarEventos(supabase, turnoId).catch(() => null),
  ]);
  if (!turno || turno.obra_id !== obraId) notFound();
  const semana = await semanaDoTurno(supabase, obraId, turno.data).catch(() => null);
  const semanaStatus = semana?.status ?? null;
  const opcoesFuncao = await opcoesFuncaoDoTurno(supabase, obraId, turno.data, turno.periodo).catch(() => [...FUNCOES_SUGERIDAS]);
  const responsaveis = (await listarResponsaveis(supabase, obraId)).map(({ id, nome, ativo }) => ({ id, nome, ativo }));
  const efetivo = turno.efetivo.map((e) => ({ funcao: e.funcao, quantidade: e.quantidade, responsavel_id: e.responsavel_id }));
  const equipesIniciais = [...new Set(turno.atividades.map((a) => a.responsavel_id))];

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/obras/${obraId}`} className="text-sm text-operacional underline">← {turno.obra.nome}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-titulo font-semibold text-primaria">
          Turno {ROTULO_PERIODO[turno.periodo].toLowerCase()} de {formatarData(turno.data)}
        </h1>
        <Selo tom={TOM_STATUS_TURNO[turno.status]}>{ROTULO_STATUS_TURNO[turno.status]}</Selo>
        <Link href={`/obras/${obraId}/quadro?turno=${turno.id}`} className={`${classesBotao("secundario")} ml-auto min-h-10 px-3 text-sm`}>
          Ver quadro
        </Link>
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
          <ListaAtividades turnoId={turno.id} obraId={obraId} responsaveis={responsaveis} atividades={turno.atividades} semanaStatus={semanaStatus} />
          <section className="rounded-cartao border border-borda bg-superficie p-4">
            <EfetivoTurno
              turnoId={turno.id}
              obraId={obraId}
              responsaveis={responsaveis}
              efetivo={efetivo}
              opcoesFuncao={opcoesFuncao}
              equipesIniciais={equipesIniciais}
            />
          </section>
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
                  <ListaAtividades
                    turnoId={turno.id}
                    obraId={obraId}
                    responsaveis={responsaveis}
                    atividades={turno.atividades}
                    trazerPendentes={false}
                    semanaStatus={semanaStatus}
                  />
                </div>
              </details>
              <EdicaoExecucao
                turnoId={turno.id}
                hora_inicio_real={turno.hora_inicio_real}
                hora_fim_real={turno.hora_fim_real}
                atividades={turno.atividades}
                efetivo={efetivo}
                clima={turno.clima}
                opcoesFuncao={opcoesFuncao}
                obraId={obraId}
                responsaveis={responsaveis}
              />
            </>
          )}
        </>
      )}
      <HistoricoTurno eventos={eventos} versoes={versoes} />
    </div>
  );
}
