/** Mensagens de negócio compartilhadas pela camada de dados (uma por público). */
import { ERRO_MOTIVO, ERRO_MOTIVO_REPETIDO } from "@/lib/dominio/eventos";

/** Planejador: turno fechado. */
export const ERRO_FECHADO_PLANEJADOR = "Turno fechado: reabra para editar";
/** Encarregado: turno fora de em_campo/enviado. */
export const ERRO_FECHADO_CAMPO = "Este turno não está aberto para lançamentos.";
export { ERRO_CAUSA_PENDENTE } from "@/lib/dominio/regras";
export const ERRO_EFETIVO_CONFLITO = "O efetivo mudou em outra tela (pode ter sido você em outra aba).";
export { PREFIXO_CONFLITO as ERRO_EXECUCAO_CONFLITO } from "@/lib/dominio/conflito";
export const ERRO_SO_PLANEJADO = "Só é possível alterar turnos planejados.";
export const ERRO_RESPONSAVEL_DUPLICADO = "Já existe um responsável com esse nome nesta obra.";
export const ERRO_RESPONSAVEL_INVALIDO = "Responsável inválido para esta obra.";
export const ERRO_EXTRA_SEM_QTD = "Para tirar o extra, remova-o.";
/** "Conte como foi o dia" (IA no campo). */
export const ERRO_LIMITE_IA = "Limite de uso da IA neste turno — lance nos cards.";
export const ERRO_RELATO_TAMANHO = "Escreva até 1.000 caracteres.";
export const ERRO_IA_INDISPONIVEL = "Não deu para organizar agora — tente de novo ou lance nos cards.";
export const ERRO_OCORRENCIA_INVALIDA ="Este registro não vale para esta equipe. Recarregue a página.";

/** Exceções de negócio levantadas pelos triggers/funções do banco (P0001 + mensagem fixa). */
export type ErroBanco =
  | "turno_fechado"
  | "causa_pendente"
  | "efetivo_conflito"
  | "motivo_obrigatorio"
  | "motivo_repetido"
  | "semana_travada"
  | "turno_aberto"
  | "programacao_vazia"
  | "atividade_com_execucao"
  | "programacao_incompativel"
  | "transicao_invalida"
  | "responsavel_invalido"
  | "ocorrencia_invalida"
  | "extra_sem_quantidade"
  | "sequencia_invalida";

const CONHECIDOS: readonly ErroBanco[] = [
  "turno_fechado",
  "causa_pendente",
  "efetivo_conflito",
  "motivo_obrigatorio",
  "motivo_repetido",
  "semana_travada",
  "turno_aberto",
  "programacao_vazia",
  "atividade_com_execucao",
  "programacao_incompativel",
  "transicao_invalida",
  "responsavel_invalido",
  "ocorrencia_invalida",
  "extra_sem_quantidade",
  "sequencia_invalida",
];

export function erroBanco(error: { code?: string; message?: string } | null | undefined): ErroBanco | null {
  if (!error || error.code !== "P0001") return null;
  return CONHECIDOS.find((k) => k === error.message) ?? null;
}

/** Mensagens da programação semanal (spec §5). */
export const MENSAGENS_PROGRAMACAO: Partial<Record<ErroBanco, string>> = {
  semana_travada: "A semana já foi programada. Reabra para editar.",
  turno_aberto: "Feche os turnos da semana antes de encerrar.",
  causa_pendente: "Informe a causa das atividades não cumpridas.",
  programacao_vazia: "Inclua ao menos uma atividade para programar.",
  atividade_com_execucao: "Esta atividade já tem execução em turnos e não pode ser apagada.",
  programacao_incompativel: "Esta atividade programada não vale para este turno.",
  transicao_invalida: "Ação não permitida para o status atual da semana.",
  motivo_obrigatorio: ERRO_MOTIVO,
  motivo_repetido: ERRO_MOTIVO_REPETIDO,
  sequencia_invalida: "Só dá para continuar uma atividade da mesma semana.",
};

export function mensagemProgramacao(error: { code?: string; message?: string } | null | undefined, padrao: string): string {
  const codigo = erroBanco(error);
  return (codigo && MENSAGENS_PROGRAMACAO[codigo]) || padrao;
}

/** "Terminei minha parte" com atividade da equipe sem causa (o app cobra antes; isto protege aba antiga). */
export const ERRO_CAUSA_TERMINEI = "Informe a causa das atividades não concluídas antes de terminar.";

export const ERRO_ENVIO_POR_TERMINEI = "Este turno é enviado quando todos os responsáveis tocam “Terminei minha parte”.";
export const ERRO_HORARIO_POR_INICIAR = "O horário deste turno sai do “Iniciar turno” e do “Terminei minha parte” de cada responsável.";
