import type { Atividade, StatusAtividade } from "./types";

export type RestricaoStatus = "aberta" | "resolvida" | "parada" | "reprogramada";

export type RestricaoHistorico = {
  id: string;
  atividadeId: number;
  obraId: number | null;
  dataTurno: string | null;
  turno: string | null;
  atividade: string;
  responsavel: string;
  texto: string;
  status: RestricaoStatus;
  registradaEm: string;
  encerradaEm?: string | null;
};

export const restricaoStorageKey = "obraboard:campo-restricoes";
export const restricaoHistoricoStorageKey = "obraboard:campo-restricoes-historico";
export const checkoutValidacoesStorageKey = "obraboard:checkout-validacoes";
export const checkoutFechamentosStorageKey = "obraboard:checkout-fechamentos";
export const turnosIniciadosStorageKey = "obraboard:turnos-iniciados";

export type FechamentosTurno = Record<
  string,
  { encerradoEm: string; automatico?: boolean }
>;

export type TurnosIniciados = Record<string, { iniciadoEm: string }>;

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
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const bruto = window.localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function salvarObjetoLocal(chave: string, valor: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(chave, JSON.stringify(valor));
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
    (item) => item.atividadeId === atividade.id && item.status === "aberta"
  );
  const agora = new Date().toISOString();

  if (existenteAberta) {
    const atualizado = historico.map((item) =>
      item.id === existenteAberta.id
        ? {
            ...item,
            texto,
            status,
            encerradaEm: status === "aberta" ? null : agora,
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
      dataTurno: atividade.data_turno ?? null,
      turno: atividade.turno ?? null,
      atividade: atividade.atividade,
      responsavel: atividade.responsavel,
      texto,
      status,
      registradaEm: agora,
      encerradaEm: status === "aberta" ? null : agora,
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
