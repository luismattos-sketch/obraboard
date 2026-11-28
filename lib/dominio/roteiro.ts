// Item 5.4: roteiro da semana (LPS conduzido) e pauta da reunião — regras puras, testáveis.
import { formatarData } from "./formato";
import type { StatusSemana } from "./programacao";
import { CAUSAS, type Causa, type Periodo, type StatusTurno } from "./tipos";

export type SituacaoPasso = "feito" | "pendente" | "atencao";
export type Passo = {
  id: "encerrar" | "lookahead" | "programar" | "turno";
  titulo: string;
  detalhe: string;
  situacao: SituacaoPasso;
  href: string;
  rotuloBotao: string;
  /** "Por que isso?" — o método em 1–2 linhas. */
  porque: string;
  /** Seção do capítulo "O método LPS". */
  ajuda: string;
};

const diaMes = (iso: string) => formatarData(iso).slice(0, 5);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const ROTULO_PERIODO_MIN: Record<Periodo, string> = { diurno: "diurno", noturno: "noturno" };
// Ordem de prioridade do turno de hoje: o que pede ação primeiro.
const PRIORIDADE: Record<StatusTurno, number> = { em_campo: 0, enviado: 1, planejado: 2, fechado: 3 };

export function passosDoRoteiro(e: {
  obraId: string;
  hoje: string;
  anterior: { inicio: string; status: StatusSemana; ppc: number | null } | null;
  proxima: { inicio: string; status: StatusSemana } | null;
  proximaInicio: string;
  restricoes: { abertas: number; vencidas: number };
  turnosHoje: { id: string; status: StatusTurno; periodo: Periodo }[];
}): Passo[] {
  const obra = `/obras/${e.obraId}`;
  const passos: Passo[] = [];

  if (e.anterior && e.anterior.status !== "rascunho") {
    const encerrada = e.anterior.status === "encerrada";
    passos.push({
      id: "encerrar",
      titulo: "Encerrar a semana passada",
      detalhe: encerrada
        ? `PPC ${e.anterior.ppc === null ? "—" : `${Math.round(e.anterior.ppc * 100)}%`}`
        : `Semana de ${diaMes(e.anterior.inicio)} aguardando encerramento`,
      situacao: encerrada ? "feito" : "atencao",
      href: `${obra}/programacao/${e.anterior.inicio}`,
      rotuloBotao: encerrada ? "Ver causas" : "Encerrar",
      porque: "Fechar a semana com a causa de cada atividade não cumprida é o que gera o aprendizado: o PPC mostra quanto do compromisso foi cumprido e as causas mostram o que atacar.",
      ajuda: "encerrar",
    });
  }

  const { abertas, vencidas } = e.restricoes;
  passos.push({
    id: "lookahead",
    titulo: "Olhar o Lookahead",
    detalhe: vencidas > 0
      ? plural(vencidas, "restrição vencida", "restrições vencidas")
      : abertas > 0 ? plural(abertas, "restrição aberta", "restrições abertas") : "Nenhuma restrição aberta",
    situacao: vencidas > 0 ? "atencao" : abertas > 0 ? "pendente" : "feito",
    href: `${obra}/lookahead`,
    rotuloBotao: "Abrir Lookahead",
    porque: "Olhar 3 a 6 semanas à frente dá tempo de remover as restrições (PT, material, liberação de área) antes de a atividade chegar à semana.",
    ajuda: "lookahead",
  });

  const status = e.proxima?.status ?? null;
  passos.push({
    id: "programar",
    titulo: "Programar a próxima semana",
    detalhe: `Semana de ${diaMes(e.proximaInicio)} ${status === "programada" || status === "encerrada" ? "programada" : status === "rascunho" ? "em rascunho" : "sem programação"}`,
    situacao: status === "programada" || status === "encerrada" ? "feito" : "pendente",
    href: `${obra}/programacao/${e.proximaInicio}`,
    rotuloBotao: "Abrir programação",
    porque: "O compromisso da semana só deve ter o que está livre de restrição e cabe na equipe. É contra ele que o PPC é medido.",
    ajuda: "programar",
  });

  const turno = [...e.turnosHoje].sort((a, b) => PRIORIDADE[a.status] - PRIORIDADE[b.status])[0];
  if (turno) {
    const per = ROTULO_PERIODO_MIN[turno.periodo];
    passos.push({
      id: "turno",
      titulo: "Turno de hoje",
      detalhe: turno.status === "planejado" ? `Check-in do turno ${per}` : turno.status === "fechado" ? "Turno fechado" : `Fechar o turno ${per}`,
      situacao: turno.status === "fechado" ? "feito" : "pendente",
      href: `${obra}/turnos/${turno.id}`,
      rotuloBotao: "Abrir turno",
      porque: "No check-in a equipe confirma o que vai fazer; no check-out registra o que fez e a causa do que não fez. É o dado que alimenta o PPC.",
      ajuda: "turno",
    });
  }
  return passos;
}

export function agruparCausas(naoCumpridas: { causa: Causa | null }[]) {
  const n = new Map<Causa | null, number>();
  for (const a of naoCumpridas) n.set(a.causa, (n.get(a.causa) ?? 0) + 1);
  return [...n.entries()]
    .map(([causa, qtd]) => ({ causa, rotulo: causa ? CAUSAS[causa] : "Sem causa", n: qtd }))
    .sort((a, b) => (a.causa === null ? 1 : 0) - (b.causa === null ? 1 : 0) || b.n - a.n);
}

export function restricoesPorResponsavel<T extends { responsavel: string; prazo: string | null; removida_em: string | null }>(
  lista: T[],
  hoje: string,
): { responsavel: string; itens: (T & { vencida: boolean })[] }[] {
  const grupos = new Map<string, (T & { vencida: boolean })[]>();
  for (const r of lista) {
    if (r.removida_em) continue;
    const itens = grupos.get(r.responsavel) ?? [];
    itens.push({ ...r, vencida: !!r.prazo && r.prazo < hoje });
    grupos.set(r.responsavel, itens);
  }
  const ordemItem = (a: T & { vencida: boolean }, b: T & { vencida: boolean }) =>
    Number(b.vencida) - Number(a.vencida) ||
    (a.prazo === b.prazo ? 0 : a.prazo === null ? 1 : b.prazo === null ? -1 : a.prazo.localeCompare(b.prazo));
  return [...grupos.entries()]
    .map(([responsavel, itens]) => ({ responsavel, itens: itens.sort(ordemItem) }))
    .sort((a, b) => Number(b.itens.some((i) => i.vencida)) - Number(a.itens.some((i) => i.vencida)) || a.responsavel.localeCompare(b.responsavel, "pt-BR"));
}
