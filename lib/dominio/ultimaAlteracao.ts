/** "Quem alterou por último", para o planejador ver no card e no efetivo (item 10). */

const HORA_SP = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

const hora = (iso: string) => HORA_SP.format(new Date(iso));

/** lancado_por_id nulo com hora = planejador ("você"). Sem hora = registro antigo, sem selo. */
export function ultimaAlteracao(
  a: { lancado_por_id: string | null; lancado_em: string | null },
  nome: (id: string) => string,
): string | null {
  if (!a.lancado_em) return null;
  return `${a.lancado_por_id ? nome(a.lancado_por_id) : "você"} · ${hora(a.lancado_em)}`;
}

/** Linhas de uma equipe são recriadas a cada salvamento: vale a mais recente. */
export function ultimaAlteracaoEfetivo(
  linhas: { lancado_pelo_planejador: boolean; created_at: string }[],
  nomeEquipe: string,
): string | null {
  if (linhas.length === 0) return null;
  const ult = linhas.reduce((m, l) => (l.created_at > m.created_at ? l : m));
  return `${ult.lancado_pelo_planejador ? "você" : nomeEquipe} · ${hora(ult.created_at)}`;
}
