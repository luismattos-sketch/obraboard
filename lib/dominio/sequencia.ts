import { qtdComUnidade } from "./plural";
import { dataDoDia, diaDaSemana, realizadoAte, sugestaoDoDia, type AtividadeProgramada, type DiaSemana, type ExecucaoLigada } from "./programacao";
import { compararTurnos } from "./regras";
import type { Periodo } from "./tipos";

/**
 * Atividades em sequência (item 19, decidido em 2026-11-17). Atividades ligadas por `continua_de` formam uma
 * sequência na ordem dos turnos (Seg D, Seg N, Ter D…). Meta de cada turno = parte própria + débito (ou − sobra)
 * do turno anterior da sequência, o que dá: soma das partes até este turno − executado antes dele. O último
 * turno fica com todo o saldo. Sem vínculo, vale a regra de sempre (`sugestaoDoDia`).
 */

type Ativ = Pick<AtividadeProgramada, "id" | "meta" | "dias" | "periodo" | "responsavel_id"> & { continua_de?: string | null };
type Turno = { id?: string; data: string; periodo: Periodo };

const arred = (x: number) => Math.round(x * 100) / 100;

/** Membros da sequência de `id` (a própria atividade, se não tem vínculo), na ordem do primeiro turno. */
export function membrosDaSequencia<T extends Ativ>(atividades: T[], id: string): T[] {
  const porId = new Map(atividades.map((a) => [a.id, a]));
  if (!porId.has(id)) return [];
  const vistos = new Set<string>([id]);
  const fila = [id];
  while (fila.length > 0) {
    const atual = fila.pop()!;
    const vizinhos = [
      porId.get(atual)?.continua_de ?? null,
      ...atividades.filter((a) => a.continua_de === atual).map((a) => a.id),
    ];
    for (const v of vizinhos) {
      if (v && porId.has(v) && !vistos.has(v)) {
        vistos.add(v);
        fila.push(v);
      }
    }
  }
  const primeiro = (a: T) => Math.min(...a.dias) * 2 + (a.periodo === "noturno" ? 1 : 0);
  return atividades.filter((a) => vistos.has(a.id)).sort((a, b) => primeiro(a) - primeiro(b));
}

/** Parte própria de cada dia (meta ÷ dias; inteira arredonda para cima; último dia = o que sobra). */
export function partesPlanejadas(a: Pick<AtividadeProgramada, "meta" | "dias">): Map<DiaSemana, number> {
  const dias = [...a.dias].sort((x, y) => x - y);
  const parte = Number.isInteger(a.meta) ? Math.ceil(a.meta / dias.length) : arred(a.meta / dias.length);
  let resta = a.meta;
  const r = new Map<DiaSemana, number>();
  dias.forEach((d, i) => {
    const p = i === dias.length - 1 ? arred(resta) : Math.min(parte, arred(resta));
    r.set(d, p);
    resta = arred(resta - p);
  });
  return r;
}

export type MetaNoTurno = {
  /** Quantidade do turno; null = nada a fazer (saldo já cumprido ou dia fora da atividade). */
  meta: number | null;
  /** Meta − parte própria: > 0 herdou débito, < 0 o turno anterior adiantou. */
  herdado: number;
  /** Atividade do turno anterior da sequência (para "do turno do dia (Luis)"). */
  anterior: Ativ | null;
};

/** Meta da atividade programada `id` no turno; execuções do próprio turno não contam. */
export function metaNoTurno(
  d: { semana: { inicio: string }; atividades: Ativ[]; execucoes: ExecucaoLigada[] },
  id: string,
  turno: Turno,
): MetaNoTurno {
  const a = d.atividades.find((x) => x.id === id);
  const dia = diaDaSemana(d.semana.inicio, turno.data);
  const nada: MetaNoTurno = { meta: null, herdado: 0, anterior: null };
  if (!a || dia === null) return nada;
  const outras = d.execucoes.filter((e) => (turno.id ? e.turno_id !== turno.id : !(e.data === turno.data && e.periodo === turno.periodo)));
  const membros = membrosDaSequencia(d.atividades, id);
  if (membros.length <= 1) return { ...nada, meta: sugestaoDoDia(a, dia, realizadoAte(outras, id)) };

  const turnos = membros
    .flatMap((m) => [...partesPlanejadas(m)].map(([dd, parte]) => ({ m, data: dataDoDia(d.semana.inicio, dd), periodo: m.periodo, parte })))
    .sort(compararTurnos);
  const k = turnos.findIndex((t) => t.m.id === id && t.data === turno.data && t.periodo === turno.periodo);
  if (k < 0) return nada;
  // Débito = Σ (parte − executado) dos turnos anteriores que já lançaram; quem ainda não lançou conta como
  // cumprido (recalcula quando lançar). Execução de membro fora dos turnos dele (adiantada) desconta.
  const ids = new Set(membros.map((m) => m.id));
  const antes = turnos.slice(0, k);
  const doTurno = (e: ExecucaoLigada, t: (typeof turnos)[number]) => e.programacao_atividade_id === t.m.id && e.data === t.data && e.periodo === t.periodo;
  let debito = 0;
  for (const t of antes) {
    const lancadas = outras.filter((e) => doTurno(e, t) && e.qtd_realizada !== null);
    if (lancadas.length > 0) debito += t.parte - lancadas.reduce((s, e) => s + (e.qtd_realizada ?? 0), 0);
  }
  debito -= outras
    .filter((e) => ids.has(e.programacao_atividade_id) && compararTurnos(e, turno) < 0 && !turnos.some((t) => doTurno(e, t)))
    .reduce((s, e) => s + (e.qtd_realizada ?? 0), 0);
  const meta = arred(turnos[k].parte + debito);
  return {
    meta: meta > 0 ? meta : null,
    herdado: arred(meta - turnos[k].parte),
    anterior: k > 0 ? turnos[k - 1].m : null,
  };
}

/** "inclui 4 m do turno do dia (Luis)" / "desconta 3 m adiantados pelo turno da noite (Alberto)"; null sem herança. */
export function textoOrigemMeta(m: MetaNoTurno, unidade: string | null, nomeAnterior: string | null): string | null {
  if (m.meta === null || !m.anterior || m.herdado === 0) return null;
  const turno = m.anterior.periodo === "diurno" ? "turno do dia" : "turno da noite";
  const quem = nomeAnterior ? ` (${nomeAnterior})` : "";
  const qtd = qtdComUnidade(Math.abs(m.herdado), unidade);
  return m.herdado > 0 ? `inclui ${qtd} do ${turno}${quem}` : `desconta ${qtd} adiantados pelo ${turno}${quem}`;
}

/**
 * "Continuar no próximo turno": atividade de um dia → o turno seguinte (dia → noite; noite → dia seguinte);
 * de vários dias → o outro período nos mesmos dias. null = não há próximo turno na semana.
 */
export function proximoTurno(a: Pick<AtividadeProgramada, "dias" | "periodo">): { dias: DiaSemana[]; periodo: Periodo } | null {
  if (a.dias.length > 1) return { dias: [...a.dias], periodo: a.periodo === "diurno" ? "noturno" : "diurno" };
  const d = a.dias[0];
  if (d === undefined) return null;
  if (a.periodo === "diurno") return { dias: [d], periodo: "noturno" };
  return d < 6 ? { dias: [(d + 1) as DiaSemana], periodo: "diurno" } : null;
}

/** Lista da programação: atividades soltas e sequências (membros juntos), na ordem da primeira aparição. */
export function agruparSequencias<T extends Ativ>(atividades: T[]): T[][] {
  const vistos = new Set<string>();
  const grupos: T[][] = [];
  for (const a of atividades) {
    if (vistos.has(a.id)) continue;
    const g = membrosDaSequencia(atividades, a.id);
    g.forEach((m) => vistos.add(m.id));
    grupos.push(g);
  }
  return grupos;
}
