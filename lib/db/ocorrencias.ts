import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chaveFuncao } from "@/lib/dominio/calculos";
import { fimPadraoParada, horaCurta, janelaDoTurno, type Ocorrencia } from "@/lib/dominio/efetivoHH";
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
import { validarFim, validarOcorrencia, type DadosOcorrencia } from "./validacao";

/**
 * Ocorrências do efetivo (empréstimo, saída antes, parados). Registradas inteiras (criar/remover, nunca editar);
 * o id vem do cliente, então reenviar o mesmo registro após um envio sem resposta não duplica.
 * Campo: cliente admin escopado ao turno do token. Planejador: cliente da sessão (RLS).
 */

const ERRO_GENERICO = "Não foi possível salvar. Tente novamente.";
export const ERRO_FUNCAO_AUSENTE = "Adicione a função no efetivo antes.";
const ERRO_MESMA_EQUIPE = "Escolha outra equipe para receber.";
const ERRO_AGUARDANDO_PROPRIA = "Escolha outra equipe.";
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
  a.causa === (b.causa ?? null) &&
  (a.observacao ?? null) === (b.observacao ?? null) &&
  (a.aguardando_responsavel_id ?? null) === (b.aguardando_responsavel_id ?? null);

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
  // Sem fim real preenchido, a equipe pode ter esticado além do previsto.
  const v = validarOcorrencia(dados, janelaDoTurno(t), { aceitaAposFim: !t.hora_fim_real });
  if (!v.ok) return v;
  const d = v.dados;

  // Reenvio de algo que já foi gravado (envio anterior sem resposta): sucesso, mesmo que a linha
  // de efetivo ou o horário do turno tenham mudado depois. A função gravada é a canônica da linha.
  const { data: jaGravada } = await c.from("efetivo_ocorrencias").select("*").eq("id", d.id).maybeSingle();
  if (jaGravada) {
    const igual = mesmaOcorrencia({ ...d, funcao: jaGravada.funcao as string, turno_id: turnoId, responsavel_id: responsavelId }, jaGravada);
    return igual ? ok(undefined) : falha(ERRO_ID_REUSADO);
  }

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

  if (d.aguardando_responsavel_id) {
    if (d.aguardando_responsavel_id === responsavelId) return falha(ERRO_AGUARDANDO_PROPRIA);
    const { data: r } = await c
      .from("responsaveis")
      .select("id")
      .eq("id", d.aguardando_responsavel_id)
      .eq("obra_id", t.obra_id)
      .maybeSingle();
    if (!r) return falha(ERRO_RESPONSAVEL_INVALIDO);
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

/**
 * Encerra uma parada aberta (única edição permitida numa ocorrência). Condicional: só grava se ainda estiver aberta,
 * então repetir o envio ou dois aparelhos encerrando ao mesmo tempo não se anulam.
 * `responsavelId` (campo): só a equipe que registrou. undefined = planejador (qualquer equipe).
 */
async function encerrar(
  c: SupabaseClient,
  turnoId: string,
  id: string,
  horaFim: string,
  responsavelId: string | null | undefined,
  erroFechado: string,
): Promise<Resultado> {
  const { data: t, error: et } = await c
    .from("turnos")
    .select("hora_inicio_prevista, hora_fim_prevista, hora_inicio_real, hora_fim_real")
    .eq("id", turnoId)
    .maybeSingle();
  if (et || !t) return et ? traduzir(et, erroFechado) : falha(ERRO_GENERICO);
  const { data: o, error: eo } = await c
    .from("efetivo_ocorrencias")
    .select("tipo, responsavel_id, hora_inicio, hora_fim")
    .eq("id", id)
    .eq("turno_id", turnoId)
    .maybeSingle();
  if (eo && eo.code !== "22P02") return traduzir(eo, erroFechado);
  if (!o || o.tipo !== "parado") return falha(ERRO_OCORRENCIA_INVALIDA);
  if (responsavelId !== undefined && (o.responsavel_id ?? null) !== responsavelId) return falha(ERRO_OCORRENCIA_INVALIDA);
  const f = validarFim(horaCurta(String(o.hora_inicio)), horaFim, janelaDoTurno(t), !t.hora_fim_real);
  if (!f.ok) return f;

  const { data, error } = await c.from("efetivo_ocorrencias").update({ hora_fim: horaFim }).eq("id", id).is("hora_fim", null).select("id");
  if (error) return traduzir(error, erroFechado);
  if (data && data.length > 0) return ok(undefined);
  const { data: atual } = await c.from("efetivo_ocorrencias").select("hora_fim").eq("id", id).maybeSingle();
  const gravado = atual?.hora_fim ? horaCurta(String(atual.hora_fim)) : null;
  if (gravado === horaCurta(horaFim)) return ok(undefined);
  return falha(gravado ? `Esta parada já foi encerrada às ${gravado}` : ERRO_GENERICO);
}

export async function encerrarParadaCampo(token: string, id: string, horaFim: string, responsavelId: string | null): Promise<Resultado> {
  const t = await turnoAberto(token);
  if (!t.ok) return t;
  return encerrar(criarClienteAdmin(), t.dados.id, id, horaFim, responsavelId, ERRO_FECHADO_CAMPO);
}

export async function encerrarParadaPlanejador(c: SupabaseClient, turnoId: string, id: string, horaFim: string): Promise<Resultado> {
  const t = await turnoAbertoParaCorrecao(c, turnoId);
  if (!t.ok) return t;
  return encerrar(c, turnoId, id, horaFim, undefined, ERRO_FECHADO_PLANEJADOR);
}

/**
 * Antes de fechar o turno: encerra todas as paradas abertas. `fins[id]` (escolhido na confirmação) ou o fim padrão
 * (fim do turno; o início se a parada começou depois dele — HH 0, gravado sem a regra "fim depois do início").
 */
export async function encerrarAbertasDoTurno(c: SupabaseClient, turnoId: string, fins: Record<string, string>): Promise<Resultado> {
  const { data: t, error: et } = await c
    .from("turnos")
    .select("hora_inicio_prevista, hora_fim_prevista, hora_inicio_real, hora_fim_real")
    .eq("id", turnoId)
    .maybeSingle();
  if (et || !t) return et ? traduzir(et, ERRO_FECHADO_PLANEJADOR) : falha(ERRO_GENERICO);
  const { data: abertas, error } = await c
    .from("efetivo_ocorrencias")
    .select("*")
    .eq("turno_id", turnoId)
    .eq("tipo", "parado")
    .is("hora_fim", null);
  if (error) return traduzir(error, ERRO_FECHADO_PLANEJADOR);
  const janela = janelaDoTurno(t);
  for (const o of (abertas ?? []) as Ocorrencia[]) {
    const escolhido = fins[o.id];
    if (escolhido) {
      const r = await encerrar(c, turnoId, o.id, escolhido, undefined, ERRO_FECHADO_PLANEJADOR);
      if (!r.ok) return falha(`${o.funcao} (desde ${horaCurta(o.hora_inicio)}): ${r.erro}`);
      continue;
    }
    const { error: eu } = await c
      .from("efetivo_ocorrencias")
      .update({ hora_fim: fimPadraoParada(o, janela) })
      .eq("id", o.id)
      .is("hora_fim", null);
    if (eu) return traduzir(eu, ERRO_FECHADO_PLANEJADOR);
  }
  return ok(undefined);
}
