import { compararTurnos } from "./regras";
import type { Periodo, StatusTurno } from "./tipos";

/** Uma versão oficial como as listas de RDOs a mostram. */
export type ItemVersao = {
  id: string;
  turnoId: string;
  obraId: string;
  obraNome: string;
  numero: number;
  emitidoEm: string;
  retroativa: boolean;
  data: string;
  periodo: Periodo;
  turnoStatus: StatusTurno;
  percentual: number | null;
};

/** Um turno na lista: a versão atual e as anteriores (mais nova primeiro). */
export type GrupoRdo = {
  turnoId: string;
  obraId: string;
  obraNome: string;
  data: string;
  periodo: Periodo;
  reaberto: boolean;
  atual: ItemVersao;
  anteriores: ItemVersao[];
};

/** "AAAA-MM" válido ou `null` ("Todos"). */
export function normalizarMes(v: unknown): string | null {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : null;
}

/** Meses ("AAAA-MM") com RDO, mais recente primeiro. */
export function mesesDisponiveis(itens: Pick<ItemVersao, "data">[]): string[] {
  return [...new Set(itens.map((i) => i.data.slice(0, 7)))].sort().reverse();
}

export function agruparVersoes(itens: ItemVersao[], mes: string | null): GrupoRdo[] {
  const porTurno = new Map<string, ItemVersao[]>();
  for (const i of itens) {
    if (mes && !i.data.startsWith(`${mes}-`)) continue;
    porTurno.set(i.turnoId, [...(porTurno.get(i.turnoId) ?? []), i]);
  }
  const grupos = [...porTurno.values()].map((vs): GrupoRdo => {
    const [atual, ...anteriores] = [...vs].sort((a, b) => b.numero - a.numero);
    return {
      turnoId: atual.turnoId,
      obraId: atual.obraId,
      obraNome: atual.obraNome,
      data: atual.data,
      periodo: atual.periodo,
      reaberto: atual.turnoStatus !== "fechado",
      atual,
      anteriores,
    };
  });
  return grupos.sort((a, b) => compararTurnos(b, a));
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-11" -> "novembro de 2026" */
export function rotuloMes(mes: string): string {
  return `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`;
}
