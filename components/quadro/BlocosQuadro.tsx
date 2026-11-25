import { formatarPercentual } from "@/lib/dominio/formato";
import { farol, type Farol, type PpcMes } from "@/lib/dominio/ppcMes";
import type { ResumoTurno } from "@/lib/dominio/ritmo";
import { ROTULO_TIPO_PROBLEMA, vencido, type Problema } from "@/lib/dominio/problemas";

/** Itens 2.4 e 2.5: PPC do mês com farol e problemas/oportunidades em aberto (só leitura). */

const COR_FAROL: Record<Farol, string> = { verde: "bg-sucesso", amarelo: "bg-alerta", vermelho: "bg-perigo" };
const ROTULO_FAROL: Record<Farol, string> = { verde: "no verde", amarelo: "no amarelo", vermelho: "no vermelho" };
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const nomeMes = (mes: string) =>
  new Date(`${mes}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });

export function PpcDoMes({ ppc }: { ppc: PpcMes }) {
  const f = farol(ppc.aderencia.ppc);
  return (
    <section aria-label="PPC do mês" data-testid="ppc-mes" className="flex flex-col gap-2 rounded-cartao bg-superficie p-3 xl:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-bold text-primaria xl:text-xl">{`PPC do mês · ${nomeMes(ppc.mes)}`}</h3>
        <p className="flex items-center gap-2 text-sm font-semibold text-texto xl:text-lg">
          {f && <span aria-hidden="true" className={`inline-block size-3 rounded-full xl:size-4 ${COR_FAROL[f]}`} />}
          {ppc.aderencia.ppc === null
            ? "Aderência do mês: sem turno fechado"
            : `Aderência do mês ${formatarPercentual(ppc.aderencia.ppc)} (${ppc.aderencia.concluidas} de ${ppc.aderencia.total})${f ? ` · ${ROTULO_FAROL[f]}` : ""}`}
        </p>
      </div>
      <ol className="flex h-24 items-end gap-px xl:h-32" aria-label="PPC de cada dia do mês">
        {ppc.dias.map((d) => {
          const fd = farol(d.ppc);
          const rotulo = d.ppc === null ? `${ddmm(d.data)}: sem turno fechado` : `${ddmm(d.data)}: ${formatarPercentual(d.ppc)} (${d.concluidas} de ${d.total})`;
          return (
            <li key={d.data} title={rotulo} aria-label={rotulo} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-0.5">
              <div
                className={`w-full rounded-t-sm ${fd ? COR_FAROL[fd] : "bg-borda"}`}
                style={{ height: d.ppc === null ? "2px" : `${Math.max(d.ppc * 100, 4)}%` }}
              />
              <span className="text-[9px] leading-none text-texto-suave xl:text-xs">{Number(d.data.slice(8, 10))}</span>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-texto-suave xl:text-sm">Só turnos fechados · verde ≥ 80% · amarelo 60–79% · vermelho &lt; 60% · serviço extra não entra</p>
    </section>
  );
}

export function ProblemasDoQuadro({ problemas, hoje }: { problemas: Problema[]; hoje: string }) {
  if (problemas.length === 0) return null;
  return (
    <section aria-label="Problemas e oportunidades" className="flex flex-col gap-2 rounded-cartao bg-superficie p-3 xl:p-4">
      <h3 className="text-base font-bold text-primaria xl:text-xl">Problemas e oportunidades</h3>
      <ul className="grid gap-x-6 lg:grid-cols-2">
        {problemas.map((p) => {
          const atrasado = vencido(p, hoje);
          return (
            <li key={p.id} className="border-b border-borda py-1.5 last:border-b-0 xl:py-2">
              <p className="text-sm xl:text-lg">
                <span className={`mr-1.5 align-middle text-[10px] font-bold xl:text-xs ${p.tipo === "problema" ? "text-perigo" : "text-sucesso"}`}>
                  {ROTULO_TIPO_PROBLEMA[p.tipo].toUpperCase()}
                </span>
                {p.descricao}
              </p>
              {p.acao && <p className="text-sm text-texto xl:text-base">{`Ação: ${p.acao}`}</p>}
              {(p.responsavel || p.prazo) && (
                <p className={`text-xs xl:text-sm ${atrasado ? "font-semibold text-perigo" : "text-texto-suave"}`}>
                  {[p.responsavel, p.prazo && `prazo ${ddmm(p.prazo)}${atrasado ? " · vencido" : ""}`].filter(Boolean).join(" · ")}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const Barra = ({ rotulo, valor, cor, extra }: { rotulo: string; valor: number; cor: string; extra?: string }) => (
  <div className="flex flex-col gap-0.5">
    <div className="flex items-baseline justify-between gap-2 text-sm xl:text-lg">
      <span className="font-semibold text-texto">{rotulo}</span>
      <span className="text-texto">{`${formatarPercentual(valor)}${extra ? ` ${extra}` : ""}`}</span>
    </div>
    <div className="h-3 overflow-hidden rounded bg-borda xl:h-4" aria-hidden="true">
      <div className={`h-full ${cor}`} style={{ width: `${Math.max(valor * 100, 1)}%` }} />
    </div>
  </div>
);

function Anel({ valor, f }: { valor: number; f: Farol | null }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const cor = f === "verde" ? "text-sucesso" : f === "amarelo" ? "text-alerta" : "text-perigo";
  return (
    <svg viewBox="0 0 100 100" className="size-24 shrink-0 xl:size-32" aria-hidden="true">
      <circle cx="50" cy="50" r={r} fill="none" strokeWidth="12" className="stroke-borda" />
      <circle cx="50" cy="50" r={r} fill="none" strokeWidth="12" stroke="currentColor" className={cor}
        strokeDasharray={`${c * valor} ${c}`} transform="rotate(-90 50 50)" />
      <text x="50" y="57" textAnchor="middle" className="fill-texto text-[22px] font-bold">{formatarPercentual(valor)}</text>
    </svg>
  );
}

/** "Vamos fechar o dia?": anel de cumprimento + ritmo (tempo × avanço) + aderência da obra. Check-in: só a aderência. */
export function ResumoDoTurno({
  resumo: r,
  aderenciaObra,
  visao,
}: {
  resumo: ResumoTurno;
  aderenciaObra: { concluidas: number; total: number; ppc: number | null };
  visao: "checkin" | "checkout";
}) {
  const fa = farol(aderenciaObra.ppc);
  const linhaAderencia = (
    <p className="flex items-center gap-2 text-sm text-texto-suave xl:text-base">
      {fa && <span aria-hidden="true" className={`inline-block size-2.5 rounded-full ${COR_FAROL[fa]}`} />}
      {aderenciaObra.ppc === null
        ? "Aderência da obra: sem turno fechado"
        : `Aderência da obra: ${formatarPercentual(aderenciaObra.ppc)} (${aderenciaObra.concluidas} de ${aderenciaObra.total}, desde o início)`}
    </p>
  );
  if (visao === "checkin") return <section aria-label="Resumo do turno" className="rounded-cartao bg-superficie px-3 py-2">{linhaAderencia}</section>;
  const f = farol(r.cumprimento);
  return (
    <section aria-label="Resumo do turno" className="grid items-center gap-3 rounded-cartao bg-superficie p-3 md:grid-cols-[auto_1fr] xl:p-4">
      <div className="flex items-center gap-3">
        {r.cumprimento !== null && <Anel valor={r.cumprimento} f={f} />}
        <div className="flex flex-col gap-1">
          <p className="text-base font-bold text-primaria xl:text-xl">
            {r.total === 0 ? "Sem atividades programadas" : `${r.concluidas} de ${r.total} concluídas${f ? ` · ${ROTULO_FAROL[f]}` : ""}`}
          </p>
          {r.total > 0 && (
            <ul className="flex flex-wrap gap-x-3 text-sm text-texto xl:text-base">
              <li><span aria-hidden="true" className="mr-1 inline-block size-2.5 bg-sucesso" />{`${r.concluidas} concluídas`}</li>
              <li><span aria-hidden="true" className="mr-1 inline-block size-2.5 bg-alerta" />{`${r.andamento} em andamento`}</li>
              <li><span aria-hidden="true" className="mr-1 inline-block size-2.5 bg-perigo" />{`${r.naoIniciadas} não iniciadas`}</li>
            </ul>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {r.fechado && <p className="text-sm font-semibold text-primaria xl:text-lg">Resultado final</p>}
        {r.tempo !== null && <Barra rotulo="Tempo do turno" valor={r.tempo} cor="bg-operacional" />}
        {r.avanco !== null && (
          <Barra
            rotulo="Avanço do dia"
            valor={r.avanco}
            cor={r.ritmo === "abaixo" ? "bg-perigo" : "bg-sucesso"}
            extra={r.ritmo === "abaixo" ? "· ⚠ abaixo do ritmo" : r.ritmo === "no_ritmo" ? "· no ritmo" : undefined}
          />
        )}
        {linhaAderencia}
      </div>
    </section>
  );
}
