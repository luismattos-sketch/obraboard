import Link from "next/link";
import { notFound } from "next/navigation";
import { classesBotao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import { listarItensCronograma } from "@/lib/db/cronograma";
import { obterObra } from "@/lib/db/obras";
import { obterSemana, resumoSemanaAnterior } from "@/lib/db/programacao";
import { listarRestricoesDaObra } from "@/lib/db/restricoes";
import { inicioDaSemana } from "@/lib/dominio/analise";
import { itensDaSemana, semanasDoLookahead } from "@/lib/dominio/cronograma";
import { hojeSaoPaulo } from "@/lib/dominio/entrada";
import { formatarData, formatarPercentual } from "@/lib/dominio/formato";
import { ROTULO_STATUS_SEMANA, somarDias, statusExibido, TOM_STATUS_SEMANA } from "@/lib/dominio/programacao";
import { resumoRestricoes } from "@/lib/dominio/restricoes";
import { agruparCausas, restricoesPorResponsavel } from "@/lib/dominio/roteiro";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { BotaoImprimir } from "./BotaoImprimir";

const diaMes = (iso: string) => formatarData(iso).slice(0, 5);

/** Item 5.4: pauta da reunião semanal do LPS (só leitura, para projetar ou imprimir). */
export default async function ReuniaoPage({ params }: { params: Promise<{ obraId: string }> }) {
  const { obraId } = await params;
  const c = await criarClienteServidor();
  const obra = await obterObra(c, obraId);
  if (!obra) notFound();

  const hoje = hojeSaoPaulo();
  const atual = inicioDaSemana(hoje);
  const anteriorInicio = somarDias(atual, -7);
  const proximaInicio = somarDias(atual, 7);
  const [anterior, resumo, proxima, restricoes, itens] = await Promise.all([
    obterSemana(c, obraId, anteriorInicio).catch(() => null),
    resumoSemanaAnterior(c, { obra_id: obraId, inicio: atual }).catch(() => null),
    obterSemana(c, obraId, proximaInicio).catch(() => null),
    listarRestricoesDaObra(c, obraId),
    listarItensCronograma(c, obraId),
  ]);
  const nomeItem = new Map(itens.map((i) => [i.id, i.descricao]));
  const todas = [...restricoes.entries()]
    .filter(([itemId]) => nomeItem.has(itemId))
    .flatMap(([itemId, l]) => l.map((r) => ({ ...r, item: nomeItem.get(itemId)! })));
  const encerrada = anterior?.status === "encerrada";
  const grupos = restricoesPorResponsavel(todas, hoje);
  const causas = resumo ? agruparCausas(resumo.atividades.filter((a) => a.situacao !== "cumprida").map((a) => ({ causa: encerrada ? a.causa : (a.causa ?? a.causaSugerida) }))) : [];
  const statusProxima = proxima ? statusExibido(proxima.status, proxima.inicio, hoje) : null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/obras/${obra.id}`} className="text-sm text-texto-suave hover:underline print:hidden">← {obra.nome}</Link>
          <h1 className="text-titulo font-semibold text-primaria">Pauta da reunião</h1>
          <p className="text-sm text-texto-suave">{obra.nome} · semana de {diaMes(atual)} · {formatarData(hoje)}</p>
        </div>
        <BotaoImprimir />
      </div>

      <Cartao className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-primaria">1. Semana passada ({diaMes(anteriorInicio)})</h2>
        {!resumo ? (
          <p className="text-texto-suave">Nada programado na semana passada.</p>
        ) : (
          <>
            {!encerrada && <p className="text-sm font-semibold text-alerta-escura">Aguardando encerramento: PPC e causas ainda provisórios.</p>}
            <p>
              PPC <strong>{formatarPercentual(resumo.ppc.ppc)}</strong> · {resumo.ppc.cumpridas} de {resumo.ppc.total}{" "}
              {resumo.ppc.total === 1 ? "atividade cumprida" : "atividades cumpridas"}
            </p>
            {causas.length === 0 ? (
              <p className="text-texto-suave">Todas as atividades foram cumpridas.</p>
            ) : (
              <ul className="list-disc pl-5">
                {causas.map((x) => <li key={x.rotulo}>{x.rotulo}: {x.n}</li>)}
              </ul>
            )}
          </>
        )}
      </Cartao>

      <Cartao className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-primaria">2. Restrições abertas</h2>
        {grupos.length === 0 ? (
          <p className="text-texto-suave">Nenhuma restrição aberta.</p>
        ) : (
          grupos.map((g) => (
            <div key={g.responsavel} className="flex flex-col gap-1">
              <h3 className="font-semibold">{g.responsavel}</h3>
              <ul className="flex flex-col gap-1 pl-3">
                {g.itens.map((r) => (
                  <li key={r.id} className="text-sm">
                    {r.descricao} <span className="text-texto-suave">· {r.item}</span>
                    {r.prazo && <span className={r.vencida ? "font-semibold text-perigo" : "text-texto-suave"}> · prazo {diaMes(r.prazo)}{r.vencida ? " (vencida)" : ""}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </Cartao>

      <Cartao className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-primaria">3. Lookahead das próximas semanas</h2>
        {semanasDoLookahead(hoje, 3).map((s) => {
          const daSemana = itensDaSemana(itens, s);
          return (
            <div key={s} className="flex flex-col gap-1">
              <h3 className="font-semibold">Semana de {diaMes(s)}</h3>
              {daSemana.length === 0 ? (
                <p className="text-sm text-texto-suave">Nada do cronograma nesta semana.</p>
              ) : (
                <ul className="flex flex-col gap-1 pl-3">
                  {daSemana.map((i) => {
                    const { abertas, vencidas } = resumoRestricoes(restricoes.get(i.id) ?? [], hoje);
                    return (
                      <li key={i.id} className="text-sm">
                        {i.descricao}
                        {abertas > 0 && (
                          <span className={vencidas ? "font-semibold text-perigo" : "text-alerta-escura"}>
                            {" "}· {abertas} {abertas === 1 ? "restrição aberta" : "restrições abertas"}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </Cartao>

      <Cartao className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-primaria">4. Próxima semana ({diaMes(proximaInicio)})</h2>
        <div className="flex flex-wrap items-center gap-2">
          {statusProxima ? <Selo tom={TOM_STATUS_SEMANA[statusProxima]}>{ROTULO_STATUS_SEMANA[statusProxima]}</Selo> : <Selo tom="neutro">Sem programação</Selo>}
          <Link href={`/obras/${obra.id}/programacao/${proximaInicio}`} className={`${classesBotao("secundario")} print:hidden`}>Abrir programação</Link>
        </div>
      </Cartao>
    </div>
  );
}
