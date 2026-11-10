import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/ui/Aviso";
import { Cartao } from "@/components/ui/Cartao";
import { obterObra } from "@/lib/db/obras";
import { listarTurnosFechadosParaAnalise } from "@/lib/db/turnos";
import { analisarObra, normalizarSemanas, semanasDaAnalise, type Analise, type TurnoAnalise } from "@/lib/dominio/analise";
import { hojeSaoPaulo } from "@/lib/dominio/entrada";
import { formatarData, formatarPercentual, ROTULO_PERIODO } from "@/lib/dominio/formato";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { Barra } from "./Barra";
import { Expansivel } from "./Expansivel";

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

  const semanas = semanasDaAnalise(hojeSaoPaulo(), n);
  let turnos: TurnoAnalise[] | null = null;
  try {
    turnos = await listarTurnosFechadosParaAnalise(supabase, obraId, semanas[0]);
  } catch {
    turnos = null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/obras/${obra.id}`} className="text-sm text-texto-suave hover:underline">
            ← {obra.nome}
          </Link>
          <h1 className="text-titulo font-semibold text-primaria">Análise (PPC)</h1>
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
        <Conteudo analise={analisarObra(turnos, semanas)} obraId={obra.id} />
      )}
    </div>
  );
}

function Conteudo({ analise, obraId }: { analise: Analise; obraId: string }) {
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
          <p className="text-sm text-texto-suave">PPC do período</p>
          <p className="text-3xl font-semibold text-primaria">{formatarPercentual(analise.periodo.ppc)}</p>
          <p className="text-xs text-texto-suave">
            {analise.periodo.concluidas} de {analise.periodo.total} atividades
          </p>
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
            const barra = (
              <Barra
                rotulo={`${diaMes(s.inicio)}${s.atual ? " (atual)" : ""}`}
                fracao={s.ppc}
                texto={formatarPercentual(s.ppc)}
                destaque={s.atual}
              />
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

      <section aria-labelledby="titulo-causas" className="flex min-w-0 flex-col gap-2">
        <Cartao className="flex min-w-0 flex-col gap-2">
          <h2 id="titulo-causas" className="text-lg font-semibold text-primaria">Causas de não cumprimento</h2>
          {analise.causas.length === 0 ? (
            <p className="text-sm text-texto-suave">Nenhuma atividade deixou de ser cumprida no período.</p>
          ) : (
            analise.causas.map((c) => (
              <Expansivel
                key={c.causa}
                resumo={<Barra rotulo={c.rotulo} fracao={c.fracao} texto={`${c.quantidade} (${formatarPercentual(c.fracao)})`} />}
              >
                <ul className="mt-1 mb-2 flex flex-col gap-2 pl-4">
                  {c.atividades.map((a, i) => (
                    <li key={`${a.turnoId}-${i}`} className="text-sm break-words">
                      <p className="text-texto">
                        {formatarData(a.data)} · {ROTULO_PERIODO[a.periodo]} · {a.descricao}
                      </p>
                      {a.observacao && <p className="text-xs text-texto-suave">{a.observacao}</p>}
                    </li>
                  ))}
                </ul>
              </Expansivel>
            ))
          )}
        </Cartao>
      </section>
    </>
  );
}
