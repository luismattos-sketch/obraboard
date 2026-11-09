import { statusAtividade } from "./calculos";
import { ROTULO_STATUS_TURNO } from "./tipos";
import type { AtividadeExec, Periodo, StatusTurno } from "./tipos";

export function errosDeCausa(atividades: AtividadeExec[]): Record<string, string> {
  const erros: Record<string, string> = {};
  for (const at of atividades) {
    if (statusAtividade(at.qtd_planejada, at.qtd_realizada) === "concluida") continue;
    if (!at.causa) {
      erros[at.id] = "Informe a causa para atividades não concluídas";
    } else if (at.causa === "outro" && !at.observacao?.trim()) {
      erros[at.id] = "Descreva a causa na observação";
    }
  }
  return erros;
}

export const ERRO_CAUSA_PENDENTE = "Há atividades sem causa informada";

export type AcaoTurno = "liberar" | "enviar" | "fechar" | "reabrir";

export type HorarioTurno = {
  hora_inicio_prevista: string | null;
  hora_fim_prevista: string | null;
  hora_inicio_real: string | null;
  hora_fim_real: string | null;
};

/** O RDO precisa de um horário completo: o real (início e fim) ou o previsto (início e fim). */
export function temHorarioCompleto(h: HorarioTurno | undefined): boolean {
  if (!h) return false;
  return (!!h.hora_inicio_real && !!h.hora_fim_real) || (!!h.hora_inicio_prevista && !!h.hora_fim_prevista);
}

export function transicaoTurno(
  atual: StatusTurno,
  acao: AcaoTurno,
  dados: { atividades: AtividadeExec[]; horario?: HorarioTurno },
): { ok: true; novo: StatusTurno } | { ok: false; erro: string } {
  const semCausa = () => Object.keys(errosDeCausa(dados.atividades)).length > 0;

  if (acao === "liberar" && atual === "planejado") {
    if (dados.atividades.length < 1) return { ok: false, erro: "Adicione ao menos uma atividade" };
    return { ok: true, novo: "em_campo" };
  }
  if (acao === "enviar" && atual === "em_campo") {
    if (semCausa()) return { ok: false, erro: ERRO_CAUSA_PENDENTE };
    return { ok: true, novo: "enviado" };
  }
  if (acao === "fechar" && (atual === "em_campo" || atual === "enviado")) {
    if (semCausa()) return { ok: false, erro: ERRO_CAUSA_PENDENTE };
    if (!temHorarioCompleto(dados.horario)) return { ok: false, erro: "Informe o horário do turno antes de fechar" };
    return { ok: true, novo: "fechado" };
  }
  if (acao === "reabrir" && atual === "fechado") {
    return { ok: true, novo: "enviado" };
  }
  return { ok: false, erro: `Ação não permitida para turno ${ROTULO_STATUS_TURNO[atual]}` };
}

const ORDEM_PERIODO: Record<Periodo, number> = { diurno: 0, noturno: 1 };

export function compararTurnos(
  a: { data: string; periodo: Periodo },
  b: { data: string; periodo: Periodo },
): number {
  if (a.data !== b.data) return a.data < b.data ? -1 : 1;
  return ORDEM_PERIODO[a.periodo] - ORDEM_PERIODO[b.periodo];
}
