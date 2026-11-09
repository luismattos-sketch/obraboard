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
  catalogo_hh_id?: string | null;
  quantidade_planejada?: number | null;
  indice_hh_aplicado?: number | null;
  unidade_hh?: string | null;
  hh_planejado?: number | null;
  tempo_previsto_horas?: number | null;
  origem_atividade_id?: number | null;
  turno_id?: number | null;
  status: StatusAtividade;
  progresso: number | null;
  turno: string | null;
  data_turno: string | null;
};

export type AtualizacaoAtividade = Partial<
  Pick<Atividade, "status" | "realizado" | "progresso" | "responsavel">
>;

export type RecursoPrevisto = {
  id: number;
  funcao: string;
  quantidade: number;
  cargaHoraria: number;
};

export type RecursoDisponivelTurno = RecursoPrevisto & {
  obra_id?: number | null;
  turno_id?: number | null;
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

export type CatalogoHH = {
  id: string;
  disciplina: string;
  atividade: string;
  indice_hh: number | string;
  unidade: string;
};

export type TipoFotoAtividade = "inicio" | "durante" | "fim";

export type FotoAtividade = {
  id: string;
  empresa_id?: string | null;
  obra_id: number;
  turno_id?: number | null;
  atividade_id: number;
  data_turno: string;
  turno: string;
  tipo: TipoFotoAtividade;
  storage_path: string;
  nome_arquivo?: string | null;
  mime_type?: string | null;
  tamanho_bytes?: number | null;
  created_at: string;
  url?: string;
};
