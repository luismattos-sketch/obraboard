export type Periodo = "diurno" | "noturno";
/** Tom visual de selos e avisos. */
export type Tom = "neutro" | "info" | "sucesso" | "alerta" | "perigo";
export type StatusTurno = "planejado" | "em_campo" | "enviado" | "fechado";
export type StatusAtividade = "concluida" | "parcial" | "nao_iniciada";
export type Causa =
  | "material"
  | "mao_de_obra"
  | "equipamento"
  | "projeto_informacao"
  | "clima"
  | "atividade_predecessora"
  | "liberacao_area"
  | "seguranca"
  | "outro";

export const CAUSAS: Record<Causa, string> = {
  material: "Falta material",
  mao_de_obra: "Falta de gente",
  equipamento: "Equipamento (falta ou quebra)",
  projeto_informacao: "Falta projeto / informação",
  clima: "Clima",
  atividade_predecessora: "Aguardando outra equipe",
  liberacao_area: "Área não liberada / interferência",
  seguranca: "Segurança",
  outro: "Outro",
};

export type GrupoCausa = "externa" | "interna";
/** Externa = fora do controle da equipe (etiqueta no aviso; base para quadro e Análise). */
export const GRUPO_CAUSA: Record<Causa, GrupoCausa | null> = {
  material: "externa",
  mao_de_obra: "interna",
  equipamento: "interna",
  projeto_informacao: "externa",
  clima: "externa",
  atividade_predecessora: "externa",
  liberacao_area: "externa",
  seguranca: "externa",
  outro: null,
};

export type PeriodoClima = "manha" | "tarde" | "noite";
export type CondicaoClima = "bom" | "chuva_leve" | "chuva_forte";

/** Períodos do clima na ordem de exibição (tela, formulário e RDO). */
export const PERIODOS_CLIMA: readonly { id: PeriodoClima; rotulo: string }[] = [
  { id: "manha", rotulo: "Manhã" },
  { id: "tarde", rotulo: "Tarde" },
  { id: "noite", rotulo: "Noite" },
];

export const CONDICOES: Record<CondicaoClima, string> = {
  bom: "Bom",
  chuva_leve: "Chuva leve",
  chuva_forte: "Chuva forte",
};

export const ROTULO_STATUS_TURNO: Record<StatusTurno, string> = {
  planejado: "Planejado",
  em_campo: "Em campo",
  enviado: "Enviado",
  fechado: "Fechado",
};

export const ROTULO_STATUS_ATIVIDADE: Record<StatusAtividade, string> = {
  concluida: "Concluída",
  parcial: "Parcial",
  nao_iniciada: "Não iniciada",
};

export const FUNCOES_SUGERIDAS = [
  "Pedreiro",
  "Servente",
  "Carpinteiro",
  "Armador",
  "Eletricista",
  "Encanador",
  "Pintor",
  "Encarregado",
  "Operador",
];

export type AtividadeExec = {
  id: string;
  descricao: string;
  qtd_planejada: number;
  qtd_realizada: number | null;
  causa: Causa | null;
  observacao: string | null;
};

/** Lançamento de execução de uma atividade (encarregado e planejador). */
export type DadosExecucao = { qtd_realizada: number | null; causa: Causa | null; observacao: string | null };
