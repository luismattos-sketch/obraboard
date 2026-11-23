import { BotaoAjuda } from "@/components/ajuda/BotaoAjuda";
import { telaDoTurno } from "@/lib/ajuda/destino";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Selo } from "@/components/ui/Selo";
import { listarEventos } from "@/lib/db/eventos";
import { opcoesFuncaoDoTurno, semanaDoTurno } from "@/lib/db/programacao";
import { versoesDoTurno } from "@/lib/db/rdo-versoes";
import { listarResponsaveis } from "@/lib/db/responsaveis";
import { fotoCheckin } from "@/lib/db/quadro";
import { classesBotao } from "@/components/ui/Botao";
import { linkCampo, obterTurnoCompleto } from "@/lib/db/turnos";
import { formatarData, horaCurta, ROTULO_PERIODO, TOM_STATUS_TURNO } from "@/lib/dominio/formato";
import { FUNCOES_SUGERIDAS, ROTULO_STATUS_TURNO } from "@/lib/dominio/tipos";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { Aviso } from "@/components/ui/Aviso";
import { AcoesTurno } from "./AcoesTurno";
import { BlocoRdo } from "./BlocoRdo";
import { DadosTurno } from "./DadosTurno";
import { intervaloDoTurno, janelaDoTurno } from "@/lib/dominio/efetivoHH";
import { EfetivoTurno } from "./EfetivoTurno";
import { HistoricoTurno } from "./HistoricoTurno";
import { EdicaoExecucao } from "./EdicaoExecucao";
import { ListaAtividades } from "./ListaAtividades";
import { PainelLink } from "./PainelLink";
import { Resumo } from "./Resumo";
import { FaixaParadas } from "./FaixaParadas";
import { RelatosCampo } from "./RelatosCampo";
import { OQueFalta } from "./OQueFalta";
import { faltasDoTurno, fimDoTurno } from "@/lib/dominio/faltas";
import { relatosDoTurno } from "@/lib/db/relatos";
import { urlsFotos } from "@/lib/db/fotosParada";
import { paradasAbertas } from "@/lib/dominio/efetivoHH";
import { opcoesPuxarPlanejador } from "@/lib/db/foraDoDia";
import { SEM_OPCOES } from "@/lib/dominio/foraDoDia";

export default async function TurnoPage({ params }: { params: Promise<{ obraId: string; turnoId: string }> }) {
  const { obraId, turnoId } = await params;
  const supabase = await criarClienteServidor();
  const [turno, versoes, eventos, link, relatos] = await Promise.all([
    obterTurnoCompleto(supabase, turnoId),
    versoesDoTurno(supabase, turnoId),
    listarEventos(supabase, turnoId).catch(() => null),
    linkCampo(supabase, turnoId).catch(() => ({ existe: false, token: null })),
    relatosDoTurno(supabase, turnoId),
  ]);
  if (!turno || turno.obra_id !== obraId) notFound();
  const semana = await semanaDoTurno(supabase, obraId, turno.data).catch(() => null);
  const semanaStatus = semana?.status ?? null;
  const opcoesFuncao = await opcoesFuncaoDoTurno(supabase, obraId, turno.data, turno.periodo).catch(() => [...FUNCOES_SUGERIDAS]);
  const listaResponsaveis = await listarResponsaveis(supabase, obraId);
  const responsaveis = listaResponsaveis.map(({ id, nome, ativo }) => ({ id, nome, ativo }));
  const temFoto = turno.status !== "planejado" && (await fotoCheckin(supabase, turno.id).catch(() => null)) !== null;
  const efetivo = turno.efetivo.map((e) => ({ funcao: e.funcao, quantidade: e.quantidade, responsavel_id: e.responsavel_id }));
  const equipesIniciais = [...new Set(turno.atividades.map((a) => a.responsavel_id))];
  const fotos = await urlsFotos(turno.ocorrencias.map((o) => o.foto_path ?? ""));
  const opcoesPuxar =
    turno.status === "em_campo" || turno.status === "enviado" ? await opcoesPuxarPlanejador(supabase, turno.id).catch(() => SEM_OPCOES) : SEM_OPCOES;

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
        <BotaoAjuda tela={telaDoTurno(turno.status)} />
      </div>
      {turno.hora_inicio_prevista && turno.hora_fim_prevista && (
        <p className="text-sm text-texto-suave">
          Previsto: {horaCurta(turno.hora_inicio_prevista)} às {horaCurta(turno.hora_fim_prevista)}
        </p>
      )}

      {turno.status !== "planejado" && turno.status !== "fechado" && (
        <FaixaParadas
          turnoId={turno.id}
          abertas={paradasAbertas(turno.ocorrencias)}
          terminados={turno.terminados ?? []}
          responsaveis={responsaveis}
        />
      )}

      <PainelLink
        turnoId={turno.id}
        obraNome={turno.obra.nome}
        data={turno.data}
        periodo={ROTULO_PERIODO[turno.periodo].toLowerCase()}
        status={turno.status}
        tokenAtual={link.token}
        linkAntigo={link.existe && link.token === null}
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
          {turno.status !== "fechado" && (
            <OQueFalta
              grupos={faltasDoTurno({ turno, atividades: turno.atividades, relatos, terminados: turno.terminados ?? [], agora: new Date() })}
              responsaveis={listaResponsaveis.map(({ id, nome, telefone }) => ({ id, nome, telefone }))}
              contexto={{ obra: turno.obra.nome, data: turno.data, periodo: turno.periodo }}
              token={link.token}
              fim={fimDoTurno(turno)}
              enviado={turno.status === "enviado"}
              terminados={(turno.terminados ?? []).map((t) => t.responsavel_id)}
            />
          )}
          <Resumo turno={turno} />
          <BlocoRdo turnoId={turno.id} fechado={turno.status === "fechado"} versoes={versoes} />
          <RelatosCampo relatos={relatos} responsaveis={responsaveis} />
          {turno.status === "fechado" ? (
            <AcoesTurno turnoId={turno.id} fechado />
          ) : (
            <>
              <details className="rounded-cartao border border-borda bg-superficie p-4">
                <summary className="cursor-pointer text-lg font-semibold text-texto">Editar planejamento</summary>
                <div className="mt-3 flex flex-col gap-3">
                  <Aviso tom="info">Quem estiver com o link de campo precisa recarregar a página para ver as mudanças.</Aviso>
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
                ocorrencias={turno.ocorrencias}
                janela={janelaDoTurno(turno)}
                intervalo={intervaloDoTurno(turno)}
                contexto={{ obra: turno.obra.nome, data: turno.data, periodo: turno.periodo, whatsapp: turno.obra.whatsapp_planejador ?? null }}
                fotos={fotos}
                opcoesPuxar={opcoesPuxar}
              />
            </>
          )}
        </>
      )}
      <HistoricoTurno eventos={eventos} versoes={versoes} checkinHref={temFoto ? `/obras/${obraId}/turnos/${turno.id}/checkin` : null} />
    </div>
  );
}
