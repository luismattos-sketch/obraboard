import type { Atividade, StatusAtividade } from "./types";

export type RestricaoStatus = "aberta" | "resolvida" | "parada" | "reprogramada";

export type RestricaoHistorico = {
  id: string;
  atividadeId: number;
  obraId: number | null;
  turnoId?: number | null;
  dataTurno: string | null;
  turno: string | null;
  atividade: string;
  responsavel: string;
  texto: string;
  status: RestricaoStatus;
  registradaEm: string;
  paradaEm?: string | null;
  retomadaEm?: string | null;
  encerradaEm?: string | null;
  abertaEm?: string | null;
  resolvidaEm?: string | null;
  duracaoMs?: number | null;
};

export const restricaoStorageKey = "obraboard:campo-restricoes";
export const restricaoHistoricoStorageKey = "obraboard:campo-restricoes-historico";
export const checkoutValidacoesStorageKey = "obraboard:checkout-validacoes";
export const checkoutFechamentosStorageKey = "obraboard:checkout-fechamentos";
export const turnosIniciadosStorageKey = "obraboard:turnos-iniciados";
export const turnosOperacaoStorageKey = "obraboard:turnos-operacao";

export type FechamentosTurno = Record<
  string,
  { encerradoEm: string; automatico?: boolean; rdoGeradoEm?: string; tempoFinalMs?: number }
>;

export type TurnosIniciados = Record<string, { iniciadoEm: string }>;
export type TurnoStatus =
  | "planejado"
  | "publicado"
  | "em_andamento"
  | "pausado"
  | "encerrado";
export type ControleTurno = {
  status: TurnoStatus;
  publicadoEm?: string;
  iniciadoEm?: string;
  pausadoEm?: string;
  encerradoEm?: string;
  rdoGeradoEm?: string;
  elapsedMs: number;
  runningSince: number | null;
};
export type ControlesTurno = Record<string, ControleTurno>;

export function calcularAvancoReal(previsto: number | null | undefined, realizado: number | null | undefined) {
  const total = Number(previsto || 0);
  const executado = Number(realizado || 0);

  if (total <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round((executado / total) * 100)));
}

export function definirStatusPorAvanco(
  previsto: number | null | undefined,
  realizado: number | null | undefined
): StatusAtividade {
  const total = Number(previsto || 0);
  const executado = Number(realizado || 0);

  if (total > 0 && executado >= total) {
    return "Finalizada";
  }

  if (executado > 0) {
    return "Parcial";
  }

  return "Planejada";
}

export function calcularPpc(atividades: Atividade[]) {
  if (atividades.length === 0) {
    return 0;
  }

  const somaAvanco = atividades.reduce(
    (total, atividade) =>
      total + calcularAvancoReal(atividade.previsto, atividade.realizado),
    0
  );

  return Math.round(somaAvanco / atividades.length);
}

export function obterFarolOperacional(status: string, avanco: number) {
  if (status === "Restrição") {
    return "Restrição";
  }

  if (avanco >= 100) {
    return "Concluído";
  }

  if (avanco > 0) {
    return "Parcial";
  }

  return "Pendente";
}

export function atividadeEncerraTurno(atividade: { status: string }) {
  return ["Finalizada", "Parcial", "Restrição"].includes(atividade.status);
}

export function pertenceAoTurno(
  item: {
    obra_id?: number | null;
    turno_id?: number | null;
    data_turno?: string | null;
    turno?: string | null;
  },
  contexto: {
    obraId: number | null;
    turnoId: number | null;
    turno: string | null;
    dataTurno?: string | null;
  }
) {
  if (!contexto.obraId || !contexto.turnoId || item.obra_id !== contexto.obraId) {
    return false;
  }

  if (contexto.dataTurno && item.data_turno !== contexto.dataTurno) {
    return false;
  }

  if (item.turno_id !== null && item.turno_id !== undefined) {
    return Number(item.turno_id) === contexto.turnoId;
  }

  return Boolean(contexto.turno && item.turno === contexto.turno);
}

export function chaveTurno(obraId: number | null, dataTurno: string | null, turno: string | null) {
  return `${obraId ?? "sem-obra"}:${dataTurno || "sem-data"}:${turno || "sem-turno"}`;
}

export function turnoEstaEncerrado(
  fechamentos: FechamentosTurno,
  obraId: number | null,
  dataTurno: string | null,
  turno: string | null
) {
  if (!obraId || !dataTurno || !turno) {
    return false;
  }

  return Boolean(fechamentos[chaveTurno(obraId, dataTurno, turno)]);
}

export function obterControleTurno(
  controles: ControlesTurno,
  obraId: number | null,
  dataTurno: string | null,
  turno: string | null
) {
  if (!obraId || !dataTurno || !turno) {
    return null;
  }

  return controles[chaveTurno(obraId, dataTurno, turno)] ?? null;
}

export function calcularTempoTurno(controle: ControleTurno | null, agora = Date.now()) {
  if (!controle) {
    return 0;
  }

  return (
    Number(controle.elapsedMs || 0) +
    (controle.runningSince ? Math.max(0, agora - controle.runningSince) : 0)
  );
}

export function publicarControleTurno(
  controles: ControlesTurno,
  obraId: number,
  dataTurno: string,
  turno: string
) {
  const chave = chaveTurno(obraId, dataTurno, turno);
  const atual = controles[chave];

  return {
    ...controles,
    [chave]: {
      ...atual,
      status: "publicado" as const,
      publicadoEm: new Date().toISOString(),
      elapsedMs: atual?.elapsedMs ?? 0,
      runningSince: null,
    },
  };
}

export function iniciarControleTurno(
  controles: ControlesTurno,
  obraId: number,
  dataTurno: string,
  turno: string
) {
  const chave = chaveTurno(obraId, dataTurno, turno);
  const atual = controles[chave];

  if (atual?.status === "em_andamento") {
    return controles;
  }

  return {
    ...controles,
    [chave]: {
      ...atual,
      status: "em_andamento" as const,
      iniciadoEm: atual?.iniciadoEm ?? new Date().toISOString(),
      elapsedMs: atual?.elapsedMs ?? 0,
      runningSince: Date.now(),
    },
  };
}

export function pausarControleTurno(
  controles: ControlesTurno,
  obraId: number,
  dataTurno: string,
  turno: string
) {
  const chave = chaveTurno(obraId, dataTurno, turno);
  const atual = controles[chave];

  if (!atual || atual.status !== "em_andamento") {
    return controles;
  }

  return {
    ...controles,
    [chave]: {
      ...atual,
      status: "pausado" as const,
      pausadoEm: new Date().toISOString(),
      elapsedMs: calcularTempoTurno(atual),
      runningSince: null,
    },
  };
}

export function encerrarControleTurno(
  controles: ControlesTurno,
  obraId: number,
  dataTurno: string,
  turno: string
) {
  const chave = chaveTurno(obraId, dataTurno, turno);
  const atual = controles[chave];
  const agoraIso = new Date().toISOString();

  return {
    ...controles,
    [chave]: {
      ...atual,
      status: "encerrado" as const,
      encerradoEm: agoraIso,
      rdoGeradoEm: agoraIso,
      elapsedMs: calcularTempoTurno(atual),
      runningSince: null,
    },
  };
}

export function turnoEstaIniciado(
  turnosIniciados: TurnosIniciados,
  obraId: number | null,
  dataTurno: string | null,
  turno: string | null
) {
  if (!obraId || !dataTurno || !turno) {
    return false;
  }

  return Boolean(turnosIniciados[chaveTurno(obraId, dataTurno, turno)]);
}

export function carregarObjetoLocal<T>(chave: string, fallback: T): T {
  void chave;
  return fallback;
}

export function salvarObjetoLocal(chave: string, valor: unknown) {
  void chave;
  void valor;
}

export function registrarRestricaoHistorico(
  atividade: Atividade,
  texto: string,
  status: RestricaoStatus
) {
  const historico = carregarObjetoLocal<RestricaoHistorico[]>(
    restricaoHistoricoStorageKey,
    []
  );
  const existenteAberta = historico.find(
    (item) =>
      item.atividadeId === atividade.id &&
      ["aberta", "parada", "reprogramada"].includes(item.status)
  );
  const agora = new Date().toISOString();

  if (existenteAberta) {
    const atualizado = historico.map((item) =>
      item.id === existenteAberta.id
        ? {
            ...item,
            texto,
            status,
            paradaEm:
              status === "parada" ? item.paradaEm ?? agora : item.paradaEm ?? null,
            retomadaEm:
              item.status === "parada" && status !== "parada"
                ? item.retomadaEm ?? agora
                : item.retomadaEm ?? null,
            encerradaEm:
              status === "aberta" || status === "parada" ? null : agora,
          }
        : item
    );
    salvarObjetoLocal(restricaoHistoricoStorageKey, atualizado);
    return;
  }

  salvarObjetoLocal(restricaoHistoricoStorageKey, [
    ...historico,
    {
      id: `${atividade.id}-${Date.now()}`,
      atividadeId: atividade.id,
      obraId: atividade.obra_id ?? null,
      turnoId: atividade.turno_id ?? null,
      dataTurno: atividade.data_turno ?? null,
      turno: atividade.turno ?? null,
      atividade: atividade.atividade,
      responsavel: atividade.responsavel,
      texto,
      status,
      registradaEm: agora,
      paradaEm: status === "parada" ? agora : null,
      retomadaEm: null,
      encerradaEm: status === "aberta" || status === "parada" ? null : agora,
    },
  ]);
}

export function listarRestricoesHistorico(
  obraId: number | null,
  dataTurno: string | null,
  turno: string | null
) {
  return carregarObjetoLocal<RestricaoHistorico[]>(
    restricaoHistoricoStorageKey,
    []
  ).filter(
    (item) =>
      item.obraId === obraId &&
      (!dataTurno || item.dataTurno === dataTurno) &&
      (!turno || item.turno === turno)
  );
}

export function salvarAtividadeOperacaoCadastro(
  atividade: Atividade,
  controle?: { elapsedMs: number; runningSince: number | null }
) {
  void atividade;
  void controle;
}
