/**
 * Quais campos do card de atividade ficam abertos. Durante o dia, causa e observação ficam atrás de
 * links; abrem quando já têm valor, quando a pessoa toca no link ou quando o app cobra (erro).
 */
export function camposAbertos(p: {
  naoConcluida: boolean;
  causa: string;
  obs: string;
  erro?: string;
  abriuCausa: boolean;
  abriuObs: boolean;
}): { causa: boolean; obs: boolean } {
  return {
    causa: p.naoConcluida && (p.abriuCausa || !!p.causa || !!p.erro),
    obs: p.abriuObs || !!p.obs.trim() || (!!p.erro && p.causa === "outro"),
  };
}
