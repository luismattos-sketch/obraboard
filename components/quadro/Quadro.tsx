import Link from "next/link";
import { pessoas } from "@/lib/dominio/plural";
import { textoEquipe } from "@/lib/dominio/equipePrevista";
import { formatarPercentual, numeroBR, ROTULO_PERIODO } from "@/lib/dominio/formato";
import { ordenarPorAjuda, type FaixaQuadro, type ModeloQuadro, type ResumoEquipe, type Visao } from "@/lib/dominio/quadro";
import { CAUSAS, GRUPO_CAUSA, type StatusAtividade } from "@/lib/dominio/tipos";
import { nomeDaEquipe } from "@/lib/dominio/efetivoHH";
import { resumoDoTurno } from "@/lib/dominio/ritmo";
import type { Problema } from "@/lib/dominio/problemas";
import type { ClimaNaTela } from "@/lib/clima/tela";
import { ProblemasDoQuadro, ResumoClima, ResumoDoTurno } from "./BlocosQuadro";

/** Quadro único de check-in/check-out (link público, sem login): só leitura, faixas horizontais por responsável. */

export type PropsQuadro = {
  modelo: ModeloQuadro;
  /** Fase do quadro (faseDoQuadro): check-in até alguma equipe iniciar. */
  visao: Visao;
  /** Links já montados pela página (preservam ?turno=). Ausente = sem navegação. */
  navegacao?: { anterior: string | null; seguinte: string | null; agora: string | null };
  aviso?: string | null;
  /** Resumo do clima (gravado, ao vivo ou previsão). Ausente/sem clima = cartão não aparece. */
  clima?: ClimaNaTela | null;
  /** Resumo do turno: aderência da obra (turnos fechados desde o início) e hora atual do turno. Ausente na foto. */
  aderenciaObra?: { concluidas: number; total: number; ppc: number | null };
  agora?: string;
  /** Item 2.5: só os abertos. */
  problemas?: Problema[];
  hoje?: string;
};

const COR_BARRA: Record<StatusAtividade, string> = {
  concluida: "bg-sucesso",
  parcial: "bg-alerta",
  nao_iniciada: "bg-perigo",
};

const diaDaSemana = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "");
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const duracao = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`);
const hh = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function textoResumo(r: ResumoEquipe): string {
  if (r.total === 0) return r.extras > 0 ? "" : "Sem atividades";
  const rotulo = r.base === "programadas" ? "programadas" : r.total === 1 ? "concluída" : "concluídas";
  return `${r.concluidas} de ${r.total} ${rotulo} · ${formatarPercentual(r.percentual)}`;
}

function Recebidos({ r, nome }: { r: ResumoEquipe; nome: (id: string | null) => string }) {
  if (r.recebidos.length === 0 && r.cedidos.length === 0) return null;
  return (
    <ul className="text-sm text-operacional xl:text-base">
      {r.recebidos.map((x) => (
        <li key={x.emprestimo_id}>{`+${pessoas(x.quantidade, x.funcao)} (de ${nome(x.de)}, ${x.inicio}–${x.fim})`}</li>
      ))}
      {r.cedidos.map((x) => (
        <li key={`c-${x.emprestimo_id}`} className="text-texto-suave">{`−${pessoas(x.quantidade, x.funcao)} (para ${nome(x.para)}, ${x.inicio}–${x.fim})`}</li>
      ))}
    </ul>
  );
}

function Faixa({
  faixa,
  visao,
  mostrarExtra,
  unidadeVazia,
  nome: nomeDe,
}: {
  faixa: FaixaQuadro;
  visao: Visao;
  mostrarExtra: boolean;
  unidadeVazia: string;
  nome: (id: string | null) => string;
}) {
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
          <>
            {faixa.efetivo.length === 0 && r.recebidos.length === 0 && r.cedidos.length === 0 ? (
              <p className="text-sm text-texto-suave">Efetivo não informado</p>
            ) : (
              <ul className="text-sm text-operacional xl:text-base">
                {faixa.efetivo.map((e, i) => (
                  <li key={i}>{pessoas(e.quantidade, e.funcao)}</li>
                ))}
              </ul>
            )}
            <Recebidos r={r} nome={nomeDe} />
            {r.iniciouEm && <p className="text-sm font-semibold text-operacional xl:text-base">{`▶ iniciou ${r.iniciouEm}`}</p>}
          </>
        ) : (
          <>
            <p className="text-sm text-operacional xl:text-base">
              {`${r.pessoas} ${r.pessoas === 1 ? "pessoa" : "pessoas"}`}
              {r.hh !== null && ` · ${hh(r.hh)} HH`}
              {r.hhParado ? ` · ${hh(r.hhParado)} HH parados` : ""}
            </p>
            <Recebidos r={r} nome={nomeDe} />
            {(r.iniciouEm || r.terminouEm) && (
              <p className="text-sm font-semibold text-sucesso xl:text-base">
                {[r.iniciouEm && `▶ iniciou ${r.iniciouEm}`, r.terminouEm && `✓ terminou ${r.terminouEm}`].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="text-sm font-semibold text-texto xl:text-base">
              {textoResumo(r)}
              {r.extras > 0 && <span className="ml-1 text-destaque">{`+${r.extras} extra`}</span>}
              {r.adiantadas > 0 && <span className="ml-1 text-destaque">{`+${r.adiantadas} adiantada`}</span>}
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
                    {textoEquipe(a.equipe) && <span className="block text-xs text-texto-suave xl:text-sm">{textoEquipe(a.equipe)}</span>}
                    {a.meta_origem && <span className="block text-xs text-texto-suave xl:text-sm">{`Meta ${a.meta_origem}`}</span>}
                  </span>
                  {visao === "checkout" && (a.qtd_realizada ?? 0) > a.qtd_planejada && (
                    <span className="shrink-0 rounded-full bg-sucesso px-2 text-xs font-bold text-white xl:text-sm">▲ acima da meta</span>
                  )}
                  <span className="shrink-0 font-semibold">
                    {visao === "checkin"
                      ? `${numeroBR(a.qtd_planejada)} ${un}`
                      : `${numeroBR(a.qtd_realizada ?? 0)} / ${numeroBR(a.qtd_planejada)} ${un}`}
                  </span>
                </div>
                {visao === "checkout" && (
                  <>
                    <div className="mt-1 h-1.5 overflow-hidden rounded bg-borda xl:h-2" aria-hidden="true">
                      <div className={`h-full ${COR_BARRA[a.situacao]}`} style={{ width: `${pct > 0 ? Math.max(pct * 100, 3) : 0}%` }} />
                    </div>
                    {a.causa && a.situacao !== "concluida" && (
                      <p className={`mt-0.5 text-sm font-semibold xl:text-lg ${GRUPO_CAUSA[a.causa] === "externa" ? "text-alerta-escura" : "text-perigo"}`}>
                        {`${GRUPO_CAUSA[a.causa] === "externa" ? "Causa externa" : GRUPO_CAUSA[a.causa] === "interna" ? "Causa interna" : "Causa"}: ${CAUSAS[a.causa]}`}
                      </p>
                    )}
                    {a.observacao && <p className="mt-0.5 text-xs text-texto-suave xl:text-base">{a.observacao}</p>}
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

export function Quadro({ modelo, visao, navegacao, aviso, clima, aderenciaObra, agora, problemas, hoje }: PropsQuadro) {
  const { entrada: e, faixas } = modelo;
  const fechado = e.turno.status === "fechado";
  const mostrarExtra = e.atividades.some((a) => a.programada);
  const nomeEquipe = nomeDaEquipe(e.responsaveis);
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
          {!fechado && agora && <span className="text-xs opacity-90 xl:text-sm">{`Atualizado ${agora}`}</span>}
        </div>
      </header>

      {navegacao && (
        <nav className="flex items-center gap-1 text-primaria">
          {navegacao.anterior ? <Link href={navegacao.anterior} className={link} aria-label="Turno anterior">←</Link> : <span className="px-2 text-texto-suave">←</span>}
          {navegacao.agora && <Link href={navegacao.agora} className={link}>Agora</Link>}
          {navegacao.seguinte ? <Link href={navegacao.seguinte} className={link} aria-label="Turno seguinte">→</Link> : <span className="px-2 text-texto-suave">→</span>}
        </nav>
      )}

      {aviso && <p className="rounded-cartao bg-alerta-clara px-3 py-2 text-sm text-alerta-escura">{aviso}</p>}

      {clima?.clima && <ResumoClima clima={clima.clima} previsao={clima.previsao} parcial={clima.parcial} />}

      {modelo.paradas.length > 0 && (
        <section role="alert" aria-label="Paradas em aberto" className="flex flex-col gap-1 rounded-cartao bg-perigo px-4 py-3 text-white">
          {modelo.paradas.map((p, i) => (
            <p key={i} className="text-lg font-bold xl:text-2xl">
              {`⚠ ${p.equipe} · ${p.texto}${p.duracaoMin !== null ? ` (${duracao(p.duracaoMin)})` : ""}`}
            </p>
          ))}
        </section>
      )}

      {aderenciaObra && (
        <ResumoDoTurno resumo={resumoDoTurno(e.turno, e.atividades, agora)} aderenciaObra={aderenciaObra} visao={visao} />
      )}

      {faixas.length === 0 ? (
        <p className="rounded-cartao bg-superficie p-4 text-texto-suave">Nenhuma atividade neste turno.</p>
      ) : (
        (visao === "checkout" ? ordenarPorAjuda(modelo) : faixas).map((f) => (
          <Faixa key={f.responsavel?.id ?? "sem"} faixa={f} visao={visao} mostrarExtra={mostrarExtra} unidadeVazia="un" nome={nomeEquipe} />
        ))
      )}

      {problemas && hoje && <ProblemasDoQuadro problemas={problemas} hoje={hoje} />}
    </div>
  );
}
