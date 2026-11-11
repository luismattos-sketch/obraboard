import { hhTurno } from "./calculos";
import { formatarData } from "./formato";
import { compararTurnos } from "./regras";
import type { Causa, Periodo, StatusTurno, Tom } from "./tipos";

export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type StatusSemana = "rascunho" | "programada" | "encerrada";
export type StatusExibido = StatusSemana | "aguardando_encerramento";
export type Situacao = "cumprida" | "em_andamento" | "sem_execucao";
export type EquipePrevista = { funcao: string; quantidade: number };

export type Semana = {
  id: string;
  obra_id: string;
  inicio: string;
  status: StatusSemana;
  programada_em: string | null;
  encerrada_em: string | null;
  motivo_reabertura: string | null;
};

export type AtividadeProgramada = {
  id: string;
  ordem: number;
  descricao: string;
  local: string | null;
  unidade: string | null;
  meta: number;
  dias: DiaSemana[];
  periodo: Periodo;
  causa: Causa | null;
  equipe: EquipePrevista[];
};

export type ExecucaoLigada = {
  id: string;
  programacao_atividade_id: string;
  turno_id: string;
  data: string;
  periodo: Periodo;
  status_turno: StatusTurno;
  qtd_planejada: number;
  qtd_realizada: number | null;
  causa: Causa | null;
};

export type TurnoDaSemana = {
  id: string;
  data: string;
  periodo: Periodo;
  status: StatusTurno;
  hora_inicio_prevista: string | null;
  hora_fim_prevista: string | null;
  hora_inicio_real: string | null;
  hora_fim_real: string | null;
  efetivo: EquipePrevista[];
  extras: { id: string; descricao: string; unidade: string | null; qtd_planejada: number; qtd_realizada: number | null }[];
};

export type DadosSemana = {
  semana: Semana;
  atividades: AtividadeProgramada[];
  execucoes: ExecucaoLigada[];
  turnos: TurnoDaSemana[];
};

export type PpcSemanal = { cumpridas: number; total: number; ppc: number | null };
export type LinhaFuncao = { funcao: string; previsto: number; real: number | null; diferenca: number | null };
export type BlocoPrevistoReal = {
  data: string;
  periodo: Periodo;
  semTurno: boolean;
  funcoes: LinhaFuncao[];
  hhPrevisto: number | null;
  hhReal: number | null;
};
export type AtividadeResumida = AtividadeProgramada & {
  realizado: number;
  saldo: number;
  situacao: Situacao;
  causaSugerida: Causa | null;
};
export type ResumoSemana = {
  atividades: AtividadeResumida[];
  ppc: PpcSemanal;
  extras: (TurnoDaSemana["extras"][number] & { data: string; periodo: Periodo })[];
  previstoReal: BlocoPrevistoReal[];
};

export const ROTULO_STATUS_SEMANA: Record<StatusExibido, string> = {
  rascunho: "Rascunho",
  programada: "Programada",
  aguardando_encerramento: "Aguardando encerramento",
  encerrada: "Encerrada",
};

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  cumprida: "Cumprida",
  em_andamento: "Em andamento",
  sem_execucao: "Sem execução",
};

export const TOM_STATUS_SEMANA: Record<StatusExibido, Tom> = {
  rascunho: "neutro",
  programada: "info",
  aguardando_encerramento: "alerta",
  encerrada: "sucesso",
};

export const TOM_SITUACAO: Record<Situacao, Tom> = {
  cumprida: "sucesso",
  em_andamento: "alerta",
  sem_execucao: "neutro",
};

export const ROTULO_DIAS =["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

// Aritmética de datas em UTC para não depender do fuso da máquina.
const paraData = (iso: string) => new Date(`${iso}T00:00:00Z`);
export function somarDias(iso: string, dias: number): string {
  const d = paraData(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function dataDoDia(inicio: string, dia: DiaSemana): string {
  return somarDias(inicio, dia);
}

/** Dia (0 = segunda) de `data` na semana que começa em `inicio`; null fora da semana. */
export function diaDaSemana(inicio: string, data: string): DiaSemana | null {
  const diff = Math.round((paraData(data).getTime() - paraData(inicio).getTime()) / 86_400_000);
  return diff >= 0 && diff <= 6 ? (diff as DiaSemana) : null;
}

export function realizadoAte(
  execucoes: ExecucaoLigada[],
  programacaoId: string,
  statusValidos?: StatusTurno[],
): number {
  return execucoes
    .filter((e) => e.programacao_atividade_id === programacaoId)
    .filter((e) => !statusValidos || statusValidos.includes(e.status_turno))
    .reduce((s, e) => s + (e.qtd_realizada ?? 0), 0);
}

const arred2 = (x: number) => Math.round(x * 100) / 100;

export function sugestaoDoDia(
  a: Pick<AtividadeProgramada, "meta" | "dias">,
  dia: DiaSemana,
  realizado: number,
): number | null {
  if (!a.dias.includes(dia)) return null;
  const saldo = Math.max(a.meta - realizado, 0);
  if (saldo <= 0) return null;
  if (dia === Math.max(...a.dias)) return arred2(saldo);
  return Math.min(arred2(a.meta / a.dias.length), arred2(saldo));
}

export function situacaoAtividade(meta: number, realizado: number): Situacao {
  if (realizado >= meta) return "cumprida";
  return realizado > 0 ? "em_andamento" : "sem_execucao";
}

export function ppcSemanal(itens: { meta: number; realizado: number }[]): PpcSemanal {
  const cumpridas = itens.filter((i) => i.realizado >= i.meta).length;
  return { cumpridas, total: itens.length, ppc: itens.length === 0 ? null : cumpridas / itens.length };
}

/** Causa do turno mais recente (data, noturno depois do diurno) que tem causa. */
export function causaSugerida(execucoes: ExecucaoLigada[]): Causa | null {
  const ordenadas = [...execucoes].sort((a, b) => compararTurnos(b, a));
  return ordenadas.find((e) => e.causa !== null)?.causa ?? null;
}

export function normalizarFuncao(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase().replace(/\s+/g, " ");
}

type Acumulado = Map<string, { funcao: string; previsto: number; real: number }>;

function somar(acc: Acumulado, linhas: EquipePrevista[], lado: "previsto" | "real") {
  for (const l of linhas) {
    const chave = normalizarFuncao(l.funcao);
    if (!chave) continue;
    const item = acc.get(chave) ?? { funcao: l.funcao.trim(), previsto: 0, real: 0 };
    item[lado] += l.quantidade;
    acc.set(chave, item);
  }
}

export function efetivoPrevistoReal(d: DadosSemana): BlocoPrevistoReal[] {
  const chaves = new Map<string, { data: string; periodo: Periodo }>();
  const chave = (data: string, periodo: Periodo) => `${data}|${periodo}`;
  for (const a of d.atividades) {
    for (const dia of a.dias) {
      const data = dataDoDia(d.semana.inicio, dia);
      chaves.set(chave(data, a.periodo), { data, periodo: a.periodo });
    }
  }
  for (const t of d.turnos) chaves.set(chave(t.data, t.periodo), { data: t.data, periodo: t.periodo });

  return [...chaves.values()].sort(compararTurnos).map(({ data, periodo }) => {
    const dia = diaDaSemana(d.semana.inicio, data);
    const t = d.turnos.find((x) => x.data === data && x.periodo === periodo);
    const acc: Acumulado = new Map();
    for (const a of d.atividades) {
      if (a.periodo === periodo && dia !== null && a.dias.includes(dia)) somar(acc, a.equipe, "previsto");
    }
    if (t) somar(acc, t.efetivo, "real");
    const funcoes = [...acc.values()].map((f) => ({
      funcao: f.funcao,
      previsto: f.previsto,
      real: t ? f.real : null,
      diferenca: t ? f.real - f.previsto : null,
    }));
    const totalPrevisto = funcoes.reduce((s, f) => s + f.previsto, 0);
    const janelaPrevista = { inicio: t?.hora_inicio_prevista ?? null, fim: t?.hora_fim_prevista ?? null };
    const janelaReal = { inicio: t?.hora_inicio_real ?? null, fim: t?.hora_fim_real ?? null };
    return {
      data,
      periodo,
      semTurno: !t,
      funcoes,
      hhPrevisto: t ? hhTurno([{ quantidade: totalPrevisto }], janelaPrevista, janelaReal) : null,
      hhReal: t ? hhTurno(t.efetivo, janelaPrevista, janelaReal) : null,
    };
  });
}

const STATUS_OFICIAIS: StatusTurno[] = ["enviado", "fechado"];

export function resumirSemana(d: DadosSemana): ResumoSemana {
  const atividades = d.atividades.map((a) => {
    const realizado = realizadoAte(d.execucoes, a.id, STATUS_OFICIAIS);
    return {
      ...a,
      realizado,
      saldo: Math.max(a.meta - realizado, 0),
      situacao: situacaoAtividade(a.meta, realizado),
      causaSugerida: causaSugerida(d.execucoes.filter((e) => e.programacao_atividade_id === a.id)),
    };
  });
  const extras = [...d.turnos]
    .sort(compararTurnos)
    .flatMap((t) => t.extras.map((x) => ({ ...x, data: t.data, periodo: t.periodo })));
  return { atividades, ppc: ppcSemanal(atividades), extras, previstoReal: efetivoPrevistoReal(d) };
}

export function statusExibido(status: StatusSemana, inicio: string, hoje: string): StatusExibido {
  if (status === "programada" && hoje > somarDias(inicio, 6)) return "aguardando_encerramento";
  return status;
}

/** "Encerrar semana" disponível a partir do último dia com atividade programada. */
export function encerramentoLiberado(atividades: Pick<AtividadeProgramada, "dias">[], inicio: string, hoje: string): boolean {
  const dias = atividades.flatMap((a) => a.dias);
  if (dias.length === 0) return false;
  return hoje >= dataDoDia(inicio, Math.max(...dias) as DiaSemana);
}

/** "10/11 diurno, 11/11 noturno" para os turnos não fechados; null se todos fechados. */
export function rotuloTurnosAbertos(turnos: Pick<TurnoDaSemana, "data" | "periodo" | "status">[]): string | null {
  const abertos = turnos.filter((t) => t.status !== "fechado").sort(compararTurnos);
  if (abertos.length === 0) return null;
  return abertos.map((t) => `${formatarData(t.data).slice(0, 5)} ${t.periodo}`).join(", ");
}
