/** Mensagens de negócio compartilhadas pela camada de dados (uma por público). */

/** Planejador: turno fechado. */
export const ERRO_FECHADO_PLANEJADOR = "Turno fechado: reabra para editar";
/** Encarregado: turno fora de em_campo/enviado. */
export const ERRO_FECHADO_CAMPO = "Este turno não está aberto para lançamentos.";
export { ERRO_CAUSA_PENDENTE } from "@/lib/dominio/regras";
export const ERRO_EFETIVO_CONFLITO = "O efetivo foi alterado por outra pessoa. Recarregue a página.";
export const ERRO_SO_PLANEJADO = "Só é possível alterar turnos planejados.";

/** Exceções de negócio levantadas pelos triggers/funções do banco (P0001 + mensagem fixa). */
export type ErroBanco = "turno_fechado" | "causa_pendente" | "efetivo_conflito";

const CONHECIDOS: readonly ErroBanco[] = ["turno_fechado", "causa_pendente", "efetivo_conflito"];

export function erroBanco(error: { code?: string; message?: string } | null | undefined): ErroBanco | null {
  if (!error || error.code !== "P0001") return null;
  return CONHECIDOS.find((k) => k === error.message) ?? null;
}
