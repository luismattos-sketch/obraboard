import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chaveFuncao } from "@/lib/dominio/calculos";
import { horaCurta, janelaDoTurno } from "@/lib/dominio/efetivoHH";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { turnoAberto } from "./campo";
import { turnoAbertoParaCorrecao } from "./execucao";
import {
  ERRO_FECHADO_CAMPO,
  ERRO_FECHADO_PLANEJADOR,
  ERRO_OCORRENCIA_INVALIDA,
  ERRO_RESPONSAVEL_INVALIDO,
  erroBanco,
} from "./mensagens";
import { falha, ok, type Resultado } from "./resultado";
import { validarOcorrencia, type DadosOcorrencia } from "./validacao";

/**
 * Ocorrências do efetivo (empréstimo, saída antes, parados). Registradas inteiras (criar/remover, nunca editar);
 * o id vem do cliente, então reenviar o mesmo registro após um envio sem resposta não duplica.
 * Campo: cliente admin escopado ao turno do token. Planejador: cliente da sessão (RLS).
 */

const ERRO_GENERICO = "Não foi possível salvar. Tente novamente.";
export const ERRO_FUNCAO_AUSENTE = "Adicione a função no efetivo antes.";
const ERRO_MESMA_EQUIPE = "Escolha outra equipe para receber.";
const ERRO_ID_REUSADO = "Este registro já existe com outros dados. Recarregue a página.";

type Linha = Omit<DadosOcorrencia, "funcao"> & { funcao: string; turno_id: string; responsavel_id: string | null };


function traduzir(error: { code?: string; message?: string }, erroFechado: string): Resultado<never> {
  const b = erroBanco(error);
  if (b === "turno_fechado") return falha(erroFechado);
  if (b === "responsavel_invalido" || error.code === "22P02") return falha(ERRO_RESPONSAVEL_INVALIDO);
  if (b === "ocorrencia_invalida" || error.code === "23514") return falha(ERRO_OCORRENCIA_INVALIDA);
  console.error("ocorrência:", error.message);
  return falha(ERRO_GENERICO);
}

const mesmaOcorrencia = (a: Linha, b: Record<string, unknown>) =>
  a.turno_id === b.turno_id &&
  a.responsavel_id === (b.responsavel_id ?? null) &&
  a.tipo === b.tipo &&
  a.funcao === b.funcao &&
  a.quantidade === Number(b.quantidade) &&
  horaCurta(a.hora_inicio) === horaCurta(String(b.hora_inicio)) &&
  (a.hora_fim === null ? b.hora_fim === null : horaCurta(a.hora_fim) === horaCurta(String(b.hora_fim ?? ""))) &&
  a.destino_responsavel_id === (b.destino_responsavel_id ?? null) &&
  a.emprestimo_id === (b.emprestimo_id ?? null) &&
  a.causa === (b.causa ?? null);

async function gravar(
  c: SupabaseClient,
  turnoId: string,
  responsavelId: string | null,
  dados: DadosOcorrencia,
  erroFechado: string,
): Promise<Resultado> {
  const { data: t, error: et } = await c
    .from("turnos")
    .select("obra_id, hora_inicio_prevista, hora_fim_prevista, hora_inicio_real, hora_fim_real")
    .eq("id", turnoId)
    .maybeSingle();
  if (et || !t) return et ? traduzir(et, erroFechado) : falha(ERRO_GENERICO);
  const v = validarOcorrencia(dados, janelaDoTurno(t));
  if (!v.ok) return v;
  const d = v.dados;

  let funcao: string;
  if (d.emprestimo_id === null) {
    const q = c.from("efetivo").select("funcao").eq("turno_id", turnoId);
    const { data: linhas, error } = await (responsavelId === null ? q.is("responsavel_id", null) : q.eq("responsavel_id", responsavelId));
    if (error) return traduzir(error, erroFechado);
    const linha = (linhas ?? []).find((l) => chaveFuncao(l.funcao as string) === chaveFuncao(d.funcao));
    if (!linha) return falha(ERRO_FUNCAO_AUSENTE);
    funcao = linha.funcao as string;
    if (d.tipo === "emprestimo") {
      if (d.destino_responsavel_id === responsavelId) return falha(ERRO_MESMA_EQUIPE);
      const { data: r } = await c
        .from("responsaveis")
        .select("id")
        .eq("id", d.destino_responsavel_id!)
        .eq("obra_id", t.obra_id)
        .eq("ativo", true)
        .maybeSingle();
      if (!r) return falha(ERRO_RESPONSAVEL_INVALIDO);
    }
  } else {
    const { data: pai } = await c
      .from("efetivo_ocorrencias")
      .select("tipo, funcao, destino_responsavel_id")
      .eq("id", d.emprestimo_id)
      .eq("turno_id", turnoId)
      .maybeSingle();
    if (!pai || pai.tipo !== "emprestimo" || pai.destino_responsavel_id !== responsavelId) return falha(ERRO_OCORRENCIA_INVALIDA);
    funcao = pai.funcao as string;
  }

  const linha: Linha = { ...d, funcao, turno_id: turnoId, responsavel_id: responsavelId };
  const { error } = await c.from("efetivo_ocorrencias").insert(linha);
  if (!error) return ok(undefined);
  if (error.code === "23505") {
    const { data: atual } = await c.from("efetivo_ocorrencias").select("*").eq("id", d.id).maybeSingle();
    return atual && mesmaOcorrencia(linha, atual) ? ok(undefined) : falha(ERRO_ID_REUSADO);
  }
  return traduzir(error, erroFechado);
}

export async function criarOcorrenciaCampo(token: string, d: DadosOcorrencia, responsavelId: string | null): Promise<Resultado> {
  const t = await turnoAberto(token);
  if (!t.ok) return t;
  return gravar(criarClienteAdmin(), t.dados.id, responsavelId, d, ERRO_FECHADO_CAMPO);
}

/** Remove a ocorrência (e, se for empréstimo, o que foi lançado sobre ela). Inexistente = sucesso. */
export async function removerOcorrenciaCampo(token: string, id: string, responsavelId: string | null): Promise<Resultado> {
  const t = await turnoAberto(token);
  if (!t.ok) return t;
  let q = criarClienteAdmin().from("efetivo_ocorrencias").delete().eq("id", id).eq("turno_id", t.dados.id);
  if (responsavelId !== null) q = q.eq("responsavel_id", responsavelId);
  const { error } = await q;
  if (error && error.code !== "22P02") return traduzir(error, ERRO_FECHADO_CAMPO);
  return ok(undefined);
}

export async function criarOcorrenciaPlanejador(
  c: SupabaseClient,
  turnoId: string,
  responsavelId: string | null,
  d: DadosOcorrencia,
): Promise<Resultado> {
  const t = await turnoAbertoParaCorrecao(c, turnoId);
  if (!t.ok) return t;
  return gravar(c, turnoId, responsavelId, d, ERRO_FECHADO_PLANEJADOR);
}

export async function removerOcorrenciaPlanejador(c: SupabaseClient, turnoId: string, id: string): Promise<Resultado> {
  const t = await turnoAbertoParaCorrecao(c, turnoId);
  if (!t.ok) return t;
  const { error } = await c.from("efetivo_ocorrencias").delete().eq("id", id).eq("turno_id", turnoId);
  if (error && error.code !== "22P02") return traduzir(error, ERRO_FECHADO_PLANEJADOR);
  return ok(undefined);
}
