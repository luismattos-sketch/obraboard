import { horaAgoraSaoPaulo, hojeSaoPaulo } from "./entrada";
import { janelaDoTurno, type Terminado } from "./efetivoHH";
import { numeroBR } from "./formato";
import { errosDeCausa } from "./regras";
import type { AtividadeExec, StatusTurno } from "./tipos";

/** O que falta no registro do campo, por responsável (spec 2026-11-23-registros-incompletos). */
export type Falta = { tipo: "sem_lancamento" | "sem_causa" | "relato" | "terminei"; atividadeId: string | null; texto: string };
export type GrupoFaltas = { responsavelId: string | null; horaDeCobrar: boolean; faltas: Falta[] };

type TurnoFaltas = {
  status: StatusTurno;
  data: string;
  hora_inicio_prevista: string | null;
  hora_fim_prevista: string | null;
  hora_inicio_real: string | null;
  hora_fim_real: string | null;
};
type AtividadeFaltas = AtividadeExec & { unidade: string; responsavel_id: string | null };

function diaSeguinte(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Fim do turno "YYYY-MM-DD HH:MM" (real completo, senão previsto); fim ≤ início = vira o dia. */
export function fimDoTurno(t: Omit<TurnoFaltas, "status">): string | null {
  const j = janelaDoTurno(t);
  if (!j) return null;
  const ini = j.inicio.slice(0, 5);
  const fim = j.fim.slice(0, 5);
  return `${fim <= ini ? diaSeguinte(t.data) : t.data} ${fim}`;
}

export function faltasDoTurno(p: {
  turno: TurnoFaltas;
  atividades: AtividadeFaltas[];
  relatos: { responsavel_id: string; lancado: boolean }[];
  terminados: Terminado[];
  agora: Date;
}): GrupoFaltas[] {
  const { turno } = p;
  if (turno.status !== "em_campo" && turno.status !== "enviado") return [];
  const fim = fimDoTurno(turno);
  const passouDoFim = fim !== null && `${hojeSaoPaulo(p.agora)} ${horaAgoraSaoPaulo(p.agora)}` >= fim;
  const terminou = new Set(p.terminados.map((t) => t.responsavel_id));
  const semCausa = errosDeCausa(p.atividades);

  const ordem: (string | null)[] = [];
  for (const a of p.atividades) if (!ordem.includes(a.responsavel_id)) ordem.push(a.responsavel_id);

  return ordem.map((r) => {
    const horaDeCobrar = turno.status === "enviado" || (r !== null && terminou.has(r)) || passouDoFim;
    const faltas: Falta[] = [];
    for (const a of p.atividades.filter((x) => x.responsavel_id === r)) {
      if (a.qtd_realizada === null && a.tipo !== "extra") {
        faltas.push({ tipo: "sem_lancamento", atividadeId: a.id, texto: `${a.descricao} — lançar quanto foi feito` });
      } else if (horaDeCobrar && semCausa[a.id]) {
        const feito = `${numeroBR(a.qtd_realizada ?? 0)} de ${numeroBR(a.qtd_planejada)} ${a.unidade}`;
        faltas.push({ tipo: "sem_causa", atividadeId: a.id, texto: `${a.descricao} — informar a causa (${feito})` });
      }
    }
    if (r !== null && p.relatos.some((x) => x.responsavel_id === r && !x.lancado)) {
      faltas.push({ tipo: "relato", atividadeId: null, texto: "Texto contado à IA ainda não lançado" });
    }
    if (r !== null && horaDeCobrar && turno.status === "em_campo" && !terminou.has(r)) {
      faltas.push({ tipo: "terminei", atividadeId: null, texto: 'Não apertou "Terminei minha parte"' });
    }
    return { responsavelId: r, horaDeCobrar, faltas };
  });
}
