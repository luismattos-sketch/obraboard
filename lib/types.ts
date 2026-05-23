export type StatusAtividade =
  | "Planejada"
  | "Execução"
  | "Parcial"
  | "Restrição"
  | "Finalizada";

export type PrioridadeAtividade = "A" | "B" | "C";

export type Atividade = {
  id: number;
  obra_id?: number | null;
  prioridade: PrioridadeAtividade;
  disciplina: string;
  atividade: string;
  local: string;
  responsavel: string;
  previsto: number;
  realizado: number | null;
  unidade: string | null;
  tempo_previsto_horas?: number | null;
  origem_atividade_id?: number | null;
  status: StatusAtividade;
  progresso: number | null;
  turno: string | null;
  data_turno: string | null;
};

export type AtualizacaoAtividade = Partial<
  Pick<Atividade, "status" | "realizado" | "progresso">
>;

export type RecursoPrevisto = {
  id: number;
  funcao: string;
  quantidade: number;
  cargaHoraria: number;
};

export type RecursoDisponivelTurno = RecursoPrevisto & {
  obra_id?: number | null;
  data_turno: string;
  turno: string;
};

export type AtividadeRecurso = {
  id: number;
  atividade_id: number;
  funcao: string;
  quantidade_prevista: number;
  created_at?: string | null;
};
