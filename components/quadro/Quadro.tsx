import Link from "next/link";
import { formatarPercentual, numeroBR, ROTULO_PERIODO } from "@/lib/dominio/formato";
import type { FaixaQuadro, ModeloQuadro, ResumoEquipe, Visao } from "@/lib/dominio/quadro";
import { CAUSAS, type StatusAtividade } from "@/lib/dominio/tipos";

/** Quadro de check-in/check-out: só leitura, faixas horizontais por responsável (planejador, TV, gestor e foto). */

export type PropsQuadro = {
  modelo: ModeloQuadro;
  visao: Visao;
  publico: boolean;
  /** Links já montados pela página (preservam ?turno=/?visao=). Ausente = sem navegação (foto). */
  navegacao?: { anterior: string | null; seguinte: string | null; agora: string | null };
  /** Links do seletor de visão; ausente = sem seletor. `checkout` null = não oferecido (turno planejado). */
  seletor?: { checkin: string; checkout: string | null };
  aviso?: string | null;
  editarHref?: string | null;
};

const COR_BARRA: Record<StatusAtividade, string> = {
  concluida: "bg-sucesso",
  parcial: "bg-alerta",
  nao_iniciada: "bg-perigo",
};

const diaDaSemana = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "");
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const hh = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function textoResumo(r: ResumoEquipe): string {
  if (r.total === 0) return r.extras > 0 ? "" : "Sem atividades";
  const rotulo = r.base === "programadas" ? "programadas" : r.total === 1 ? "concluída" : "concluídas";
  return `${r.concluidas} de ${r.total} ${rotulo} · ${formatarPercentual(r.percentual)}`;
}

function Faixa({ faixa, visao, mostrarExtra, unidadeVazia }: { faixa: FaixaQuadro; visao: Visao; mostrarExtra: boolean; unidadeVazia: string }) {
  const nome = faixa.responsavel ? `${faixa.responsavel.nome}${faixa.responsavel.ativo ? "" : " (inativo)"}` : "Sem responsável";
  const r = faixa.resumo;
  return (
    <section
      className={`grid gap-3 rounded-cartao border-l-4 bg-superficie p-3 md:grid-cols-[11rem_1fr] xl:p-4 ${
        faixa.responsavel ? "border-operacional" : "border-borda"
      }`}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-bold text-primaria xl:text-xl">{nome}</h3>
        {visao === "checkin" ? (
          faixa.efetivo.length === 0 ? (
            <p className="text-sm text-texto-suave">Efetivo não informado</p>
          ) : (
            <ul className="text-sm text-operacional xl:text-base">
              {faixa.efetivo.map((e, i) => (
                <li key={i}>{`${e.quantidade} ${e.funcao}`}</li>
              ))}
            </ul>
          )
        ) : (
          <>
            <p className="text-sm text-operacional xl:text-base">
              {`${r.pessoas} ${r.pessoas === 1 ? "pessoa" : "pessoas"}`}
              {r.hh !== null && ` · ${hh(r.hh)} HH`}
            </p>
            <p className="text-sm font-semibold text-texto xl:text-base">
              {textoResumo(r)}
              {r.extras > 0 && <span className="ml-1 text-destaque">{`+${r.extras} extra`}</span>}
            </p>
          </>
        )}
      </div>

      {faixa.atividades.length === 0 ? (
        <p className="text-sm text-texto-suave">Nenhuma atividade</p>
      ) : (
        <ul className="grid gap-x-6 lg:grid-cols-2">
          {faixa.atividades.map((a) => {
            const un = a.unidade ?? unidadeVazia;
            const pct = a.qtd_planejada > 0 ? Math.min(1, (a.qtd_realizada ?? 0) / a.qtd_planejada) : 0;
            return (
              <li key={a.id} className="border-b border-borda py-1.5 last:border-b-0 xl:py-2">
                <div className="flex items-start justify-between gap-2 text-sm xl:text-lg">
                  <span className="min-w-0 break-words">
                    {a.descricao}
                    {a.local && <span className="text-texto-suave">{` · ${a.local}`}</span>}
                    {mostrarExtra && !a.programada && (
                      <span className="ml-1.5 align-middle text-[10px] font-bold text-destaque xl:text-xs">EXTRA</span>
                    )}
                  </span>
                  <span className="shrink-0 font-semibold">
                    {visao === "checkin"
                      ? `${numeroBR(a.qtd_planejada)} ${un}`
                      : `${numeroBR(a.qtd_realizada ?? 0)} / ${numeroBR(a.qtd_planejada)} ${un}`}
                  </span>
                </div>
                {visao === "checkout" && (
                  <>
                    <div className="mt-1 h-1.5 overflow-hidden rounded bg-borda xl:h-2" aria-hidden="true">
                      <div className={`h-full ${COR_BARRA[a.situacao]}`} style={{ width: `${Math.max(pct * 100, 3)}%` }} />
                    </div>
                    {a.causa && a.situacao !== "concluida" && (
                      <p className="mt-0.5 text-xs text-perigo xl:text-sm">{`Causa: ${CAUSAS[a.causa]}`}</p>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function Quadro({ modelo, visao, publico, navegacao, seletor, aviso, editarHref }: PropsQuadro) {
  const { entrada: e, faixas } = modelo;
  const fechado = e.turno.status === "fechado";
  const mostrarExtra = e.atividades.some((a) => a.programada);
  const seloEtapa = visao === "checkin" ? "CHECK-IN" : "CHECK-OUT";
  const link = "rounded px-2 py-1 text-sm font-semibold underline-offset-2 hover:underline";

  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2 rounded-cartao bg-primaria px-4 py-3 text-white">
        <div className="flex min-w-0 flex-col">
          <span className="text-lg font-bold xl:text-2xl">{e.obra.nome}</span>
          <span className="text-sm opacity-90 xl:text-lg">
            {`${diaDaSemana(e.turno.data)} ${ddmm(e.turno.data)} · ${ROTULO_PERIODO[e.turno.periodo]}`}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-bold xl:text-sm ${visao === "checkin" ? "bg-destaque" : "bg-operacional ring-1 ring-white"}`}>
            {seloEtapa}
          </span>
          {fechado && <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-primaria xl:text-sm">Turno fechado</span>}
        </div>
      </header>

      {(navegacao || seletor || (!publico && editarHref)) && (
        <nav className="flex flex-wrap items-center justify-between gap-2 text-primaria">
          <div className="flex items-center gap-1">
            {navegacao && (
              <>
                {navegacao.anterior ? <Link href={navegacao.anterior} className={link} aria-label="Turno anterior">←</Link> : <span className="px-2 text-texto-suave">←</span>}
                {navegacao.agora && <Link href={navegacao.agora} className={link}>Agora</Link>}
                {navegacao.seguinte ? <Link href={navegacao.seguinte} className={link} aria-label="Turno seguinte">→</Link> : <span className="px-2 text-texto-suave">→</span>}
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            {seletor && (
              <>
                {visao === "checkin" ? <span className={`${link} bg-primaria-clara`}>Check-in</span> : <Link href={seletor.checkin} className={link}>Check-in</Link>}
                {seletor.checkout !== null && (
                  visao === "checkout" ? <span className={`${link} bg-primaria-clara`}>Check-out</span> : <Link href={seletor.checkout} className={link}>Check-out</Link>
                )}
              </>
            )}
            {!publico && editarHref && <Link href={editarHref} className={`${link} text-operacional`}>Editar</Link>}
          </div>
        </nav>
      )}

      {aviso && <p className="rounded-cartao bg-alerta-clara px-3 py-2 text-sm text-alerta-escura">{aviso}</p>}

      {faixas.length === 0 ? (
        <p className="rounded-cartao bg-superficie p-4 text-texto-suave">Nenhuma atividade neste turno.</p>
      ) : (
        faixas.map((f) => (
          <Faixa key={f.responsavel?.id ?? "sem"} faixa={f} visao={visao} mostrarExtra={mostrarExtra} unidadeVazia="un" />
        ))
      )}
    </div>
  );
}
