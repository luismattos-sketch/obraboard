import { inicioDaSemana } from "./analise";
import type { Material } from "./extraApontamento";
import type { Periodo } from "./tipos";

/** Item 4.3: ciência do fiscal do cliente nos serviços extras da semana (link sem conta). */

export const NOME_CIENCIA_MAX = 100;

export type ExtraCiencia = {
  id: string;
  data: string;
  periodo: Periodo;
  descricao: string;
  local: string | null;
  qtd: number;
  unidade: string;
  responsavel: string | null;
  solicitado_por: string | null;
  extra_pessoas: number | null;
  extra_horas: number | null;
  materiais: Material[];
  observacao: string | null;
  foto_path: string | null;
  ciencia: { nome: string; ciente_em: string } | null;
};

export type SemanaCiencia = { semana: string; extras: number; cientes: number; codigo: string | null };

const DATA_HORA_SP = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
/** "2026-11-27T13:05:00Z" → "27/11/2026 10:05" (horário de Brasília). */
export const dataHoraCiencia = (iso: string) => DATA_HORA_SP.format(new Date(iso)).replace(",", "");

export function validarNomeCiencia(x: unknown): { ok: true; nome: string } | { ok: false; erro: string } {
  const nome = typeof x === "string" ? x.trim().replace(/\s+/g, " ") : "";
  if (!nome) return { ok: false, erro: "Escreva seu nome e função" };
  if (nome.length > NOME_CIENCIA_MAX) return { ok: false, erro: `Máximo de ${NOME_CIENCIA_MAX} caracteres` };
  return { ok: true, nome };
}

/** Agrupa os extras por semana (segunda), da mais recente para a mais antiga. */
export function agruparPorSemana(
  extras: { data: string; ciente: boolean }[],
  links: { semana: string; codigo: string }[],
): SemanaCiencia[] {
  const m = new Map<string, SemanaCiencia>();
  for (const e of extras) {
    const s = inicioDaSemana(e.data);
    const g = m.get(s) ?? { semana: s, extras: 0, cientes: 0, codigo: null };
    g.extras++;
    if (e.ciente) g.cientes++;
    m.set(s, g);
  }
  for (const l of links) {
    const g = m.get(l.semana);
    if (g) g.codigo = l.codigo;
  }
  return [...m.values()].sort((a, b) => b.semana.localeCompare(a.semana));
}
