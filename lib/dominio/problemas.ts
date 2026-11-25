/** Item 2.5: problemas e oportunidades do quadro. */

export type TipoProblema = "problema" | "oportunidade";
export const ROTULO_TIPO_PROBLEMA: Record<TipoProblema, string> = { problema: "Problema", oportunidade: "Oportunidade" };

export type Problema = {
  id: string;
  obra_id: string;
  tipo: TipoProblema;
  descricao: string;
  acao: string | null;
  responsavel: string | null;
  prazo: string | null;
  resolvido_em: string | null;
  created_at: string;
};

export type DadosProblema = { tipo: string; descricao: string; acao?: string | null; responsavel?: string | null; prazo?: string | null };
export type ProblemaValido = { tipo: TipoProblema; descricao: string; acao: string | null; responsavel: string | null; prazo: string | null };

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const limpo = (v: string | null | undefined) => {
  const s = (v ?? "").trim();
  return s === "" ? null : s;
};

export function validarProblema(d: DadosProblema): { ok: true; dados: ProblemaValido } | { ok: false; erro: string } {
  const tipo = d.tipo === "oportunidade" ? "oportunidade" : d.tipo === "problema" ? "problema" : null;
  if (!tipo) return { ok: false, erro: "Escolha se é problema ou oportunidade." };
  const descricao = limpo(d.descricao);
  if (!descricao) return { ok: false, erro: "Descreva o problema ou a oportunidade." };
  if (descricao.length > 300) return { ok: false, erro: "Descrição muito longa (até 300 letras)." };
  const acao = limpo(d.acao);
  if (acao && acao.length > 300) return { ok: false, erro: "Ação muito longa (até 300 letras)." };
  const responsavel = limpo(d.responsavel);
  if (responsavel && responsavel.length > 60) return { ok: false, erro: "Nome do responsável muito longo (até 60 letras)." };
  const prazo = limpo(d.prazo);
  if (prazo && (!DATA.test(prazo) || Number.isNaN(Date.parse(`${prazo}T12:00:00Z`)))) return { ok: false, erro: "Prazo inválido." };
  return { ok: true, dados: { tipo, descricao, acao, responsavel, prazo } };
}

export const vencido = (p: Pick<Problema, "prazo" | "resolvido_em">, hoje: string) => !p.resolvido_em && !!p.prazo && p.prazo < hoje;

/** Abertos primeiro (prazo mais cedo antes; sem prazo no fim), depois resolvidos (mais recente antes). */
export function ordenarProblemas<T extends Pick<Problema, "prazo" | "resolvido_em" | "created_at">>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    if (!a.resolvido_em !== !b.resolvido_em) return a.resolvido_em ? 1 : -1;
    if (a.resolvido_em && b.resolvido_em) return b.resolvido_em.localeCompare(a.resolvido_em);
    if (a.prazo !== b.prazo) return a.prazo === null ? 1 : b.prazo === null ? -1 : a.prazo.localeCompare(b.prazo);
    return a.created_at.localeCompare(b.created_at);
  });
}
