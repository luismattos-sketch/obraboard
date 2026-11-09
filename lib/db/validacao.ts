import { CAUSAS, CONDICOES, type Causa, type CondicaoClima, type PeriodoClima } from "@/lib/dominio/tipos";
import { falha, ok, type Resultado } from "./resultado";

/** Validação de entrada compartilhada entre o encarregado (campo.ts) e o planejador (execucao.ts). */

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const PERIODOS_CLIMA: PeriodoClima[] = ["manha", "tarde", "noite"];

export type DadosExecucao = { qtd_realizada: number | null; causa: Causa | null; observacao: string | null };
export type LinhaEfetivo = { funcao: string; quantidade: number };
export type DadosClima = { periodo: PeriodoClima; condicao: CondicaoClima; impediu: boolean };
export type DadosHorario = { hora_inicio_real: string | null; hora_fim_real: string | null };

export function validarExecucao(dados: DadosExecucao): Resultado {
  const q = dados.qtd_realizada;
  if (q !== null && !(typeof q === "number" && Number.isFinite(q) && q >= 0 && q < 1e12)) {
    return falha("Quantidade realizada inválida");
  }
  if (dados.causa !== null && !(typeof dados.causa === "string" && Object.hasOwn(CAUSAS, dados.causa))) {
    return falha("Causa inválida");
  }
  if (dados.observacao !== null && (typeof dados.observacao !== "string" || dados.observacao.length > 500)) {
    return falha("Observação deve ter no máximo 500 caracteres");
  }
  return ok(undefined);
}

/** Atividade concluída não guarda causa nem observação. */
export function camposExecucao(concluida: boolean, dados: DadosExecucao) {
  const observacao = dados.observacao?.trim() ? dados.observacao.trim() : null;
  return {
    qtd_realizada: dados.qtd_realizada,
    causa: concluida ? null : dados.causa,
    observacao: concluida ? null : observacao,
  };
}

export function validarEfetivo(linhas: LinhaEfetivo[]): Resultado<LinhaEfetivo[]> {
  if (!Array.isArray(linhas) || linhas.length > 50) return falha("Efetivo inválido");
  const limpas: LinhaEfetivo[] = [];
  for (const l of linhas) {
    const funcao = typeof l?.funcao === "string" ? l.funcao.trim() : "";
    if (!funcao || funcao.length > 60) return falha("Informe a função (até 60 caracteres)");
    if (!Number.isInteger(l.quantidade) || l.quantidade < 1 || l.quantidade > 999) {
      return falha("Quantidade deve ser um número inteiro entre 1 e 999");
    }
    limpas.push({ funcao, quantidade: l.quantidade });
  }
  return ok(limpas);
}

export function validarPeriodoClima(periodo: PeriodoClima): Resultado {
  return PERIODOS_CLIMA.includes(periodo) ? ok(undefined) : falha("Período do clima inválido");
}

export function validarClima(dados: DadosClima): Resultado {
  const p = validarPeriodoClima(dados.periodo);
  if (!p.ok) return p;
  if (typeof dados.condicao !== "string" || !Object.hasOwn(CONDICOES, dados.condicao)) {
    return falha("Condição do clima inválida");
  }
  return ok(undefined);
}

export function validarHorario(dados: DadosHorario): Resultado {
  for (const h of [dados.hora_inicio_real, dados.hora_fim_real]) {
    if (h !== null && !(typeof h === "string" && HORA.test(h))) return falha("Horário inválido");
  }
  return ok(undefined);
}
