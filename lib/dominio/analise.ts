import { percentualCumprimento, statusAtividade } from "./calculos";
import { compararTurnos } from "./regras";
import { CAUSAS, type Causa, type Periodo, type StatusTurno } from "./tipos";

export type OpcaoSemanas = 4 | 8 | 12;

export type AtividadeAnalise = {
  descricao: string;
  qtd_planejada: number;
  qtd_realizada: number | null;
  causa: Causa | null;
  observacao: string | null;
};

export type TurnoAnalise = {
  id: string;
  data: string;
  periodo: Periodo;
  status: StatusTurno;
  atividades: AtividadeAnalise[];
};

export type SemanaAnalise = {
  inicio: string;
  concluidas: number;
  total: number;
  ppc: number | null;
  atual: boolean;
  turnos: { id: string; data: string; periodo: Periodo; ppc: number | null }[];
};

export type CausaAnalise = {
  causa: Causa;
  rotulo: string;
  quantidade: number;
  fracao: number;
  atividades: { turnoId: string; data: string; periodo: Periodo; descricao: string; observacao: string | null }[];
};

export type Analise = {
  periodo: { concluidas: number; total: number; ppc: number | null };
  semanas: SemanaAnalise[];
  variacao: number | null;
  causas: CausaAnalise[];
};

const OPCOES: OpcaoSemanas[] = [4, 8, 12];

export function normalizarSemanas(valor: unknown): OpcaoSemanas {
  if (typeof valor !== "string") return 8;
  return OPCOES.find((o) => String(o) === valor) ?? 8;
}

// Aritmética de datas em UTC para não depender do fuso da máquina.
const paraData = (iso: string) => new Date(`${iso}T00:00:00Z`);
const paraIso = (d: Date) => d.toISOString().slice(0, 10);
function somarDias(iso: string, dias: number): string {
  const d = paraData(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return paraIso(d);
}

/** Segunda-feira (YYYY-MM-DD) da semana seg–dom que contém `data`. */
export function inicioDaSemana(data: string): string {
  const diasDesdeSegunda = (paraData(data).getUTCDay() + 6) % 7;
  return somarDias(data, -diasDesdeSegunda);
}

/** N segundas-feiras em ordem crescente; a última é a da semana de `hoje`. */
export function semanasDaAnalise(hoje: string, n: number): string[] {
  const atual = inicioDaSemana(hoje);
  return Array.from({ length: n }, (_, i) => somarDias(atual, -7 * (n - 1 - i)));
}

const concluida = (a: AtividadeAnalise) => statusAtividade(a.qtd_planejada, a.qtd_realizada) === "concluida";
const fracao = (concluidas: number, total: number) => (total === 0 ? null : concluidas / total);

export function analisarObra(turnos: TurnoAnalise[], semanas: string[]): Analise {
  const porSemana = new Map<string, SemanaAnalise>(
    semanas.map((inicio, i) => [
      inicio,
      { inicio, concluidas: 0, total: 0, ppc: null, atual: i === semanas.length - 1, turnos: [] },
    ]),
  );
  const porCausa = new Map<Causa, CausaAnalise["atividades"]>();

  const validos = turnos
    .filter((t) => t.status === "fechado" && t.atividades.length > 0)
    .sort(compararTurnos);

  for (const t of validos) {
    const semana = porSemana.get(inicioDaSemana(t.data));
    if (!semana) continue;
    semana.concluidas += t.atividades.filter(concluida).length;
    semana.total += t.atividades.length;
    semana.turnos.push({ id: t.id, data: t.data, periodo: t.periodo, ppc: percentualCumprimento(t.atividades) });
    for (const a of t.atividades) {
      if (concluida(a) || !a.causa) continue;
      const lista = porCausa.get(a.causa) ?? [];
      lista.push({ turnoId: t.id, data: t.data, periodo: t.periodo, descricao: a.descricao, observacao: a.observacao });
      porCausa.set(a.causa, lista);
    }
  }

  const lista = [...porSemana.values()].map((s) => ({ ...s, ppc: fracao(s.concluidas, s.total) }));
  const concluidas = lista.reduce((s, x) => s + x.concluidas, 0);
  const total = lista.reduce((s, x) => s + x.total, 0);

  const atual = lista.at(-1)?.ppc ?? null;
  const anterior = lista.length >= 2 ? lista[lista.length - 2].ppc : null;

  const totalCausas = [...porCausa.values()].reduce((s, x) => s + x.length, 0);
  const causas = [...porCausa.entries()]
    .map(([causa, atividades]) => ({
      causa,
      rotulo: CAUSAS[causa],
      quantidade: atividades.length,
      fracao: atividades.length / totalCausas,
      atividades,
    }))
    .sort((x, y) => y.quantidade - x.quantidade); // sort estável: empate mantém a primeira aparição

  return {
    periodo: { concluidas, total, ppc: fracao(concluidas, total) },
    semanas: lista,
    variacao: atual === null || anterior === null ? null : atual - anterior,
    causas,
  };
}
