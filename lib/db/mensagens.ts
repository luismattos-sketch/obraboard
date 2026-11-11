/** Mensagens de negócio compartilhadas pela camada de dados (uma por público). */
import { ERRO_MOTIVO, ERRO_MOTIVO_REPETIDO } from "@/lib/dominio/eventos";

/** Planejador: turno fechado. */
export const ERRO_FECHADO_PLANEJADOR = "Turno fechado: reabra para editar";
/** Encarregado: turno fora de em_campo/enviado. */
export const ERRO_FECHADO_CAMPO = "Este turno não está aberto para lançamentos.";
export { ERRO_CAUSA_PENDENTE } from "@/lib/dominio/regras";
export const ERRO_EFETIVO_CONFLITO = "O efetivo foi alterado por outra pessoa. Recarregue a página.";
export const ERRO_SO_PLANEJADO = "Só é possível alterar turnos planejados.";

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
  | "transicao_invalida";

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
};

export function mensagemProgramacao(error: { code?: string; message?: string } | null | undefined, padrao: string): string {
  const codigo = erroBanco(error);
  return (codigo && MENSAGENS_PROGRAMACAO[codigo]) || padrao;
}
