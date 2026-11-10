import {
  CAUSAS,
  CONDICOES,
  PERIODOS_CLIMA,
  type CondicaoClima,
  type DadosExecucao,
  type PeriodoClima,
} from "@/lib/dominio/tipos";
import { falha, ok, type Resultado } from "./resultado";

/** Validação de entrada compartilhada (encarregado, planejador e cadastros). */

export type { DadosExecucao };

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "HH:MM" (00:00–23:59). */
export const horaValida = (h: unknown): h is string => typeof h === "string" && HORA.test(h);

/** Limites de tamanho dos textos do planejador. */
export const LIMITES = {
  descricao: 200,
  local: 100,
  unidade: 20,
  obraNome: 120,
  obraCliente: 120,
  obraEndereco: 200,
  empresa: 120,
  nome: 120,
} as const;
export const QTD_PLANEJADA_MAX = 1e9;

export const mensagemMaximo = (max: number) => `Máximo de ${max} caracteres`;

/** Erros por campo para textos acima do limite: { campo: "Máximo de N caracteres" }. */
export function errosDeTamanho(campos: Record<string, { valor: string | null | undefined; max: number }>): Record<string, string> {
  const erros: Record<string, string> = {};
  for (const [k, { valor, max }] of Object.entries(campos)) {
    if (typeof valor === "string" && valor.trim().length > max) erros[k] = mensagemMaximo(max);
  }
  return erros;
}

/** Falha com a primeira mensagem como erro geral e todas as mensagens por campo. */
export function falhaCampos(erros: Record<string, string>): Resultado<never> | null {
  const primeira = Object.values(erros)[0];
  return primeira ? falha(primeira, erros) : null;
}

export const causaValida = (c: unknown) => typeof c === "string" && Object.hasOwn(CAUSAS, c);

/** Horários previstos opcionais ("" / null = não informado). */
export function validarHorariosPrevistos(dados: {
  hora_inicio_prevista?: string | null;
  hora_fim_prevista?: string | null;
}): Resultado {
  for (const h of [dados.hora_inicio_prevista, dados.hora_fim_prevista]) {
    if (h !== null && h !== undefined && h !== "" && !horaValida(h)) return falha("Horário inválido");
  }
  return ok(undefined);
}
export type LinhaEfetivo = { funcao: string; quantidade: number };
export type DadosClima = { periodo: PeriodoClima; condicao: CondicaoClima; impediu: boolean };
export type DadosHorario = { hora_inicio_real: string | null; hora_fim_real: string | null };

export function validarExecucao(dados: DadosExecucao): Resultado {
  const q = dados.qtd_realizada;
  if (q !== null && !(typeof q === "number" && Number.isFinite(q) && q >= 0 && q < 1e12)) {
    return falha("Quantidade realizada inválida");
  }
  if (dados.causa !== null && !causaValida(dados.causa)) {
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

/** Efetivo que o cliente leu/salvou por último (checagem otimista); só formato, sem regras de negócio. */
export function validarEfetivoEsperado(linhas: LinhaEfetivo[]): Resultado<LinhaEfetivo[]> {
  if (!Array.isArray(linhas) || linhas.length > 200) return falha("Efetivo inválido");
  const limpas: LinhaEfetivo[] = [];
  for (const l of linhas) {
    if (typeof l?.funcao !== "string" || !Number.isInteger(l.quantidade)) return falha("Efetivo inválido");
    limpas.push({ funcao: l.funcao, quantidade: l.quantidade });
  }
  return ok(limpas);
}

export function validarPeriodoClima(periodo: PeriodoClima): Resultado {
  return PERIODOS_CLIMA.some((p) => p.id === periodo) ? ok(undefined) : falha("Período do clima inválido");
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
    if (h !== null && !horaValida(h)) return falha("Horário inválido");
  }
  return ok(undefined);
}
