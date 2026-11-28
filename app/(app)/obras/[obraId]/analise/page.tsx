import { BotaoAjuda } from "@/components/ajuda/BotaoAjuda";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/ui/Aviso";
import { Cartao } from "@/components/ui/Cartao";
import { obterObra } from "@/lib/db/obras";
import { listarProgramadasParaAnalise } from "@/lib/db/programacao";
import { inicioDaObra, listarTurnosFechadosParaAnalise, listarTurnosParaHHPerdido } from "@/lib/db/turnos";
import { GRUPO_CAUSA } from "@/lib/dominio/tipos";
import {
  analisarObra,
  normalizarSemanas,
  semanasDaAnalise,
  type Analise,
  type SemanaProgramadaAnalise,
  type TurnoAnalise,
} from "@/lib/dominio/analise";
import { hojeSaoPaulo } from "@/lib/dominio/entrada";
import { formatarData, formatarPercentual, ROTULO_PERIODO } from "@/lib/dominio/formato";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { Selo } from "@/components/ui/Selo";
import { Barra } from "./Barra";
import { Expansivel } from "@/components/ui/Expansivel";
import { PpcDiaADia } from "@/components/analise/PpcDiaADia";
import { ppcPorDia, type DiaPpc } from "@/lib/dominio/ppcMes";
import { listarResponsaveis } from "@/lib/db/responsaveis";
import { hhPerdidoDaObra, type HHPerdido } from "@/lib/dominio/hhPerdido";
import { numeroBR } from "@/lib/dominio/formato";

const OPCOES = [4, 8, 12] as const;

/** "2026-11-09" -> "09/11" */
const diaMes = (iso: string) => formatarData(iso).slice(0, 5);

export default async function AnalisePage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const { obraId } = await params;
  const n = normalizarSemanas((await searchParams).semanas);
  const supabase = await criarClienteServidor();
  const obra = await obterObra(supabase, obraId);
  if (!obra) notFound();

  const inicio = await inicioDaObra(supabase, obraId, obra.created_at).catch(() => null);
  const semanas = semanasDaAnalise(hojeSaoPaulo(), n, inicio);
  let turnos: TurnoAnalise[] | null = null;
  let programadas: SemanaProgramadaAnalise[] = [];
  // HH perdido carrega à parte: se falhar, o resto da análise aparece.
  const hhPromessa = Promise.all([
    listarTurnosParaHHPerdido(supabase, obraId, semanas[0]),
    listarResponsaveis(supabase, obraId),
  ])
    .then(([t, r]) => hhPerdidoDaObra(t, r))
    .catch(() => null);
  try {
    [turnos, programadas] = await Promise.all([
      listarTurnosFechadosParaAnalise(supabase, obraId, semanas[0]),
      listarProgramadasParaAnalise(supabase, obraId, semanas[0]),
    ]);
  } catch {
    turnos = null;
  }
  const hh = await hhPromessa;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/obras/${obra.id}`} className="text-sm text-texto-suave hover:underline">
            ← {obra.nome}
          </Link>
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-titulo font-semibold text-primaria">Análise (PPC)</h1>
            <BotaoAjuda tela="analise" />
          </div>
        </div>
        <nav aria-label="Período" className="flex overflow-hidden rounded-botao border border-borda bg-superficie text-sm">
          {OPCOES.map((o) => (
            <Link
              key={o}
              href={`/obras/${obra.id}/analise?semanas=${o}`}
              aria-current={o === n ? "page" : undefined}
              className={`px-3 py-2 ${o === n ? "bg-operacional font-semibold text-white" : "text-primaria hover:bg-primaria-clara"}`}
            >
              {o} sem
            </Link>
          ))}
        </nav>
      </div>

      {turnos === null ? (
        <Aviso tom="perigo">Não foi possível carregar a análise. Tente novamente.</Aviso>
      ) : (
        <>
          <Conteudo analise={analisarObra(turnos, semanas, programadas)} obraId={obra.id} dias={ppcPorDia(turnos, semanas[0], hojeSaoPaulo()).dias} />
          <SecaoComRestricao programadas={programadas} />
          {turnos.length > 0 && <SecaoHHPerdido hh={hh} />}
        </>
      )}
    </div>
  );
}

/** Item 5.3: atividades que entraram na semana com restrição aberta e quantas foram cumpridas. */
function SecaoComRestricao({ programadas }: { programadas: SemanaProgramadaAnalise[] }) {
  const com = programadas.reduce(
    (t, p) => ({ total: t.total + (p.comRestricao?.total ?? 0), cumpridas: t.cumpridas + (p.comRestricao?.cumpridas ?? 0) }),
    { total: 0, cumpridas: 0 },
  );
  if (com.total === 0) return null;
  const geral = programadas.reduce((t, p) => ({ total: t.total + p.total, cumpridas: t.cumpridas + p.cumpridas }), { total: 0, cumpridas: 0 });
  const pct = (c: number, t: number) => (t ? `${Math.round((c / t) * 100)}%` : "—");
  return (
    <Cartao className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-primaria">Entraram com restrição</h2>
      <p className="text-texto">
        {com.total} {com.total === 1 ? "atividade entrou" : "atividades entraram"} na semana com restrição aberta;{" "}
        {com.cumpridas} {com.cumpridas === 1 ? "foi cumprida" : "foram cumpridas"} ({pct(com.cumpridas, com.total)}).
      </p>
      <p className="text-sm text-texto-suave">
        Cumprimento de todas as atividades programadas no período: {pct(geral.cumpridas, geral.total)}.
      </p>
    </Cartao>
  );
}

const GRUPOS = [
  { id: "externa", rotulo: "Externas (fora do controle da equipe)" },
  { id: "interna", rotulo: "Internas" },
  { id: "outra", rotulo: "Outras" },
] as const;

/** "12,5 HH" com uma casa. */
const horasHH = (h: number) => `${numeroBR(Math.round(h * 10) / 10)} HH`;

function SecaoHHPerdido({ hh }: { hh: HHPerdido | null }) {
  return (
    <section aria-labelledby="titulo-hh-perdido" className="flex min-w-0 flex-col gap-2">
      <Cartao className="flex min-w-0 flex-col gap-3">
        <h2 id="titulo-hh-perdido" className="text-lg font-semibold text-primaria">HH perdido em paradas</h2>
        {hh === null ? (
          <Aviso tom="perigo">Não foi possível calcular o HH perdido. Tente novamente.</Aviso>
        ) : hh.total === 0 ? (
          <p className="text-sm text-texto-suave">Nenhuma parada registrada nos turnos fechados do período.</p>
        ) : (
          <>
            <div>
              <p className="text-3xl font-semibold text-primaria">{horasHH(hh.total)}</p>
              <p className="text-xs text-texto-suave">
                em {hh.turnos} {hh.turnos === 1 ? "turno fechado" : "turnos fechados"} · ⓘ pessoas paradas × horas paradas, sem o intervalo
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-texto">Por grupo de causa</h3>
              {hh.grupos.map((g) => (
                <Barra
                  key={g.grupo}
                  rotulo={GRUPOS.find((x) => x.id === g.grupo)!.rotulo}
                  fracao={g.fracao}
                  texto={`${horasHH(g.hh)} (${formatarPercentual(g.fracao)})`}
                />
              ))}
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-texto">Por causa</h3>
              {hh.causas.map((c) => (
                <Barra key={c.causa} rotulo={c.rotulo} fracao={c.fracao} texto={`${horasHH(c.hh)} (${formatarPercentual(c.fracao)})`} />
              ))}
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-texto">Por responsável</h3>
              {hh.equipes.map((e) => (
                <Expansivel
                  key={e.responsavelId ?? "sem"}
                  resumo={<Barra rotulo={e.nome} fracao={e.fracao} texto={`${horasHH(e.hh)} (${formatarPercentual(e.fracao)})`} />}
                >
                  <ul className="mt-1 mb-2 flex flex-col gap-1 pl-4">
                    {e.causas.map((c) => (
                      <li key={c.causa} className="flex justify-between gap-3 text-sm text-texto">
                        <span>{c.rotulo}</span>
                        <span>{horasHH(c.hh)}</span>
                      </li>
                    ))}
                  </ul>
                </Expansivel>
              ))}
            </div>
          </>
        )}
      </Cartao>
    </section>
  );
}

function Conteudo({ analise, obraId, dias }: { analise: Analise; obraId: string; dias: DiaPpc[] }) {
  if (analise.periodo.total === 0) {
    return (
      <Cartao>
        <p className="text-texto-suave">Feche turnos para ver a análise.</p>
      </Cartao>
    );
  }
  const atual = analise.semanas.at(-1);
  const pts = analise.variacao === null ? null : Math.round(analise.variacao * 100);

  return (
    <>
      <section aria-labelledby="titulo-indicadores" className="grid gap-3 sm:grid-cols-2">
        <h2 id="titulo-indicadores" className="sr-only">Indicadores</h2>
        <Cartao className="flex flex-col gap-1">
          <p className="flex items-center gap-2 text-sm text-texto-suave">
            PPC do período{analise.semanas.some((s) => s.provisorio || (s.atual && s.turnos.length > 0)) && <Selo tom="alerta">provisório</Selo>}
          </p>
          <p className="text-3xl font-semibold text-primaria">{formatarPercentual(analise.periodo.ppc)}</p>
          <p className="text-xs text-texto-suave">
            {analise.periodo.concluidas} de {analise.periodo.total} atividades
          </p>
          <p className="text-xs text-texto-suave">ⓘ Soma dos turnos fechados: conta a atividade que chegou à meta do dia.</p>
        </Cartao>
        <Cartao className="flex flex-col gap-1">
          <p className="text-sm text-texto-suave">Semana atual</p>
          <p className="text-3xl font-semibold text-primaria">{formatarPercentual(atual?.ppc ?? null)}</p>
          {pts !== null && (
            <p className="text-xs text-texto-suave">
              {pts > 0 ? "▲" : pts < 0 ? "▼" : "="} {Math.abs(pts)} pts vs anterior
            </p>
          )}
        </Cartao>
      </section>

      <section aria-labelledby="titulo-semanas" className="flex min-w-0 flex-col gap-2">
        <Cartao className="flex min-w-0 flex-col gap-2">
          <h2 id="titulo-semanas" className="text-lg font-semibold text-primaria">PPC por semana</h2>
          {analise.semanas.map((s) => {
            const marca = s.programada ? (
              s.provisorio ? (
                <Selo tom="alerta">provisório</Selo>
              ) : null
            ) : s.turnos.length > 0 ? (
              <Selo tom="neutro">sem programação</Selo>
            ) : null;
            const barra = (
              <div className="flex flex-col gap-1">
                <Barra
                  rotulo={`${diaMes(s.inicio)}${s.atual ? " (atual)" : ""}`}
                  fracao={s.ppc}
                  texto={formatarPercentual(s.ppc)}
                  destaque={s.atual}
                />
                {(marca || s.programada) && (
                  <span className="flex flex-wrap items-center gap-2 text-xs">
                    {marca}
                    {s.programada && (
                      <Link href={`/obras/${obraId}/programacao/${s.inicio}`} className="text-operacional hover:underline">
                        Ver programação
                      </Link>
                    )}
                  </span>
                )}
              </div>
            );
            if (s.turnos.length === 0) return <div key={s.inicio} className="pl-5">{barra}</div>;
            return (
              <Expansivel key={s.inicio} resumo={barra}>
                <ul className="mt-1 mb-2 flex flex-col gap-1 pl-4">
                  {s.turnos.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/obras/${obraId}/turnos/${t.id}`}
                        className="flex justify-between gap-3 text-sm text-operacional hover:underline"
                      >
                        <span>
                          {formatarData(t.data)} · {ROTULO_PERIODO[t.periodo]}
                        </span>
                        <span>{formatarPercentual(t.ppc)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Expansivel>
            );
          })}
        </Cartao>
      </section>

      <section aria-labelledby="titulo-dia-a-dia" className="flex min-w-0 flex-col gap-2">
        <Cartao className="flex min-w-0 flex-col gap-2">
          <h2 id="titulo-dia-a-dia" className="text-lg font-semibold text-primaria">PPC dia a dia</h2>
          <PpcDiaADia dias={dias} />
        </Cartao>
      </section>

      <section aria-labelledby="titulo-causas" className="flex min-w-0 flex-col gap-2">
        <Cartao className="flex min-w-0 flex-col gap-2">
          <h2 id="titulo-causas" className="text-lg font-semibold text-primaria">Causas de não cumprimento</h2>
          {analise.causas.length === 0 ? (
            <p className="text-sm text-texto-suave">Nenhuma atividade deixou de ser cumprida no período.</p>
          ) : (
            GRUPOS.map((g) => {
              const lista = analise.causas.filter((c) => (GRUPO_CAUSA[c.causa] ?? "outra") === g.id);
              if (lista.length === 0) return null;
              return (
                <div key={g.id} className="flex flex-col gap-1">
                  <h3 className="text-sm font-semibold text-texto">{g.rotulo}</h3>
                  {lista.map((c) => (
              <Expansivel
                key={c.causa}
                resumo={<Barra rotulo={c.rotulo} fracao={c.fracao} texto={`${c.quantidade} (${formatarPercentual(c.fracao)})`} />}
              >
                <ul className="mt-1 mb-2 flex flex-col gap-2 pl-4">
                  {c.atividades.map((a, i) =>
                    a.origem === "turno" ? (
                      <li key={`${a.turnoId}-${i}`} className="text-sm break-words">
                        <p className="text-texto">
                          {formatarData(a.data)} · {ROTULO_PERIODO[a.periodo]} · {a.descricao}
                        </p>
                        {a.observacao && <p className="text-xs text-texto-suave">{a.observacao}</p>}
                      </li>
                    ) : (
                      <li key={`${a.semanaInicio}-${i}`} className="text-sm break-words">
                        <Link href={`/obras/${obraId}/programacao/${a.semanaInicio}`} className="text-operacional hover:underline">
                          Semana de {diaMes(a.semanaInicio)} · {a.descricao}
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              </Expansivel>
                  ))}
                </div>
              );
            })
          )}
        </Cartao>
      </section>
    </>
  );
}
