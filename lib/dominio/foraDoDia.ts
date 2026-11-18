import { LIMITES, QTD_PLANEJADA_MAX } from "@/lib/db/validacao";
import { falha, ok, type Resultado } from "@/lib/db/resultado";
import {
  diaDaSemana,
  realizadoAte,
  sugestaoDoDia,
  type DadosSemana,
  type DiaSemana,
  type StatusSemana,
} from "./programacao";
import { ROTULO_TIPO, type Periodo, type TipoAtividade, type Tom } from "./tipos";

/**
 * Atividades fora do dia (spec 2026-11-17): adiantar atividade futura da semana, continuar atrasada,
 * lançar serviço extra. Regras puras; a gravação está em lib/db/foraDoDia.ts.
 */

export type ModoPuxar = "adiantar" | "atrasada";
export type OpcaoPuxar = {
  programacaoAtividadeId: string;
  descricao: string;
  unidade: string | null;
  dias: DiaSemana[];
  saldo: number;
  responsavel_id: string | null;
};
export type OpcoesPuxar = { adiantar: OpcaoPuxar[]; atrasadas: OpcaoPuxar[] };
export const SEM_OPCOES: OpcoesPuxar = { adiantar: [], atrasadas: [] };

const arred = (x: number) => Math.round(x * 1e6) / 1e6;

/**
 * O que dá para puxar para o turno. `responsavelId` null = planejador (todas as equipes).
 * Adiantar: todos os dias marcados depois de hoje. Atrasada: algum dia marcado antes de hoje.
 * Saldo = meta − executado em outros turnos da semana (qualquer status).
 */
export function opcoesParaPuxar(
  d: DadosSemana,
  turno: { id: string; data: string; periodo: Periodo },
  responsavelId: string | null,
): OpcoesPuxar {
  if (d.semana.status !== "programada") return { adiantar: [], atrasadas: [] };
  const hoje = diaDaSemana(d.semana.inicio, turno.data);
  if (hoje === null) return { adiantar: [], atrasadas: [] };
  const noTurno = new Set(d.execucoes.filter((e) => e.turno_id === turno.id).map((e) => e.programacao_atividade_id));
  const outras = d.execucoes.filter((e) => e.turno_id !== turno.id);
  const r: OpcoesPuxar = { adiantar: [], atrasadas: [] };
  for (const a of d.atividades) {
    if (a.periodo !== turno.periodo || noTurno.has(a.id)) continue;
    if (responsavelId !== null && a.responsavel_id !== responsavelId) continue;
    const saldo = arred(a.meta - realizadoAte(outras, a.id));
    if (saldo <= 0) continue;
    const opcao: OpcaoPuxar = {
      programacaoAtividadeId: a.id,
      descricao: a.descricao,
      unidade: a.unidade,
      dias: a.dias,
      saldo,
      responsavel_id: a.responsavel_id,
    };
    if (a.dias.some((x) => x < hoje)) r.atrasadas.push(opcao);
    else if (a.dias.length > 0 && a.dias.every((x) => x > hoje)) r.adiantar.push(opcao);
  }
  return r;
}

/**
 * Depois de lançar execução numa adiantada: cópias dessa atividade em turnos futuros ainda planejados
 * e sem execução recebem a nova sugestão do dia (null = remover a cópia).
 */
export function copiasParaAjustar(
  d: DadosSemana,
  programacaoId: string,
  aPartirDe: string,
): { turnoId: string; atividadeId: string; nova: number | null }[] {
  const a = d.atividades.find((x) => x.id === programacaoId);
  if (!a) return [];
  const realizado = realizadoAte(d.execucoes, programacaoId);
  return d.execucoes
    .filter(
      (e) =>
        e.programacao_atividade_id === programacaoId &&
        e.data > aPartirDe &&
        e.status_turno === "planejado" &&
        e.qtd_realizada === null &&
        !e.tipo,
    )
    .flatMap((e) => {
      const dia = diaDaSemana(d.semana.inicio, e.data);
      if (dia === null) return [];
      const nova = sugestaoDoDia(a, dia, realizado);
      return nova === e.qtd_planejada ? [] : [{ turnoId: e.turno_id, atividadeId: e.id, nova }];
    });
}

export type DadosExtra = {
  id: string;
  descricao: string;
  unidade: string;
  qtd: number;
  observacao: string | null;
  responsavel_id: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validarExtra(d: unknown): Resultado<DadosExtra> {
  const x = (d ?? {}) as Partial<Record<keyof DadosExtra, unknown>>;
  if (typeof x.id !== "string" || !UUID.test(x.id)) return falha("Registro inválido. Recarregue a página.");
  const descricao = typeof x.descricao === "string" ? x.descricao.trim() : "";
  const unidade = typeof x.unidade === "string" ? x.unidade.trim() : "";
  if (!descricao) return falha("Informe a descrição", { descricao: "Informe a descrição" });
  if (descricao.length > LIMITES.descricao) return falha(`Máximo de ${LIMITES.descricao} caracteres`, { descricao: `Máximo de ${LIMITES.descricao} caracteres` });
  if (!unidade) return falha("Informe a unidade", { unidade: "Informe a unidade" });
  if (unidade.length > LIMITES.unidade) return falha(`Máximo de ${LIMITES.unidade} caracteres`, { unidade: `Máximo de ${LIMITES.unidade} caracteres` });
  const qtd = x.qtd;
  if (typeof qtd !== "number" || !Number.isFinite(qtd) || qtd <= 0) return falha("Informe a quantidade", { qtd: "Informe a quantidade" });
  if (qtd > QTD_PLANEJADA_MAX) return falha("Quantidade deve ser no máximo 1.000.000.000", { qtd: "Quantidade deve ser no máximo 1.000.000.000" });
  const obs = typeof x.observacao === "string" && x.observacao.trim() ? x.observacao.trim() : null;
  if (obs !== null && obs.length > 500) return falha("Observação deve ter no máximo 500 caracteres");
  const resp = typeof x.responsavel_id === "string" && x.responsavel_id ? x.responsavel_id : null;
  return ok({ id: x.id, descricao, unidade, qtd, observacao: obs, responsavel_id: resp });
}

/** "lançado por você" (quem está no link) ou "lançado pelo campo — Nome"; null = criada pelo planejador. */
export function autorDoLancamento(
  a: { criada_por_id: string | null },
  nome: (id: string | null) => string,
  responsavelAtual: string | null,
): string | null {
  if (!a.criada_por_id) return null;
  return a.criada_por_id === responsavelAtual ? "lançado por você" : `lançado pelo campo — ${nome(a.criada_por_id)}`;
}

/** Selo da atividade no planejamento do turno. Avulsa = incluída à mão numa semana programada (conta no dia). */
export function seloDaAtividade(
  a: { tipo: TipoAtividade | null; programacao_atividade_id: string | null },
  semanaStatus: StatusSemana | null,
): { texto: string; tom: Tom } | null {
  if (a.tipo === "extra") return { texto: ROTULO_TIPO.extra, tom: "alerta" };
  if (a.tipo === "adiantada") return { texto: ROTULO_TIPO.adiantada, tom: "info" };
  if (a.programacao_atividade_id) return { texto: "Programada", tom: "info" };
  return semanaStatus === "programada" || semanaStatus === "encerrada" ? { texto: "Avulsa", tom: "neutro" } : null;
}

/** O planejador remove pelo botão do cartão só o que foi lançado fora do planejamento. */
export const podeRemoverPlanejador = (a: { tipo: TipoAtividade | null; criada_por_id: string | null; puxada?: boolean }) =>
  a.tipo !== null || a.criada_por_id !== null || a.puxada === true;
