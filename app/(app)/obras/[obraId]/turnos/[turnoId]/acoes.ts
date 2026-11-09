"use server";

import { revalidatePath } from "next/cache";
import {
  adicionarAtividade,
  editarAtividade,
  moverAtividade,
  removerAtividade,
  trazerPendentes,
} from "@/lib/db/atividades";
import { falha, ok, type Resultado } from "@/lib/db/resultado";
import { parseNumero } from "@/lib/dominio/entrada";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export type EstadoAcao =
  | (Resultado<{ mensagem?: string } | undefined> & { valores?: Record<string, string>; envio?: number })
  | null;

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function atualizar() {
  revalidatePath("/obras/[obraId]/turnos/[turnoId]", "page");
}

const CAMPOS_FORM = ["descricao", "local", "unidade", "qtd_planejada"] as const;

/** Falha preservando o que o usuário digitou (React 19 limpa campos não controlados após a action). */
function falhaForm(form: FormData, erro: string, campos?: Record<string, string>): EstadoAcao {
  const valores: Record<string, string> = {};
  for (const k of CAMPOS_FORM) valores[k] = String(form.get(k) ?? "");
  return { ...falha(erro, campos), valores, envio: Date.now() };
}

type Leitura =
  | { erro: EstadoAcao; dados?: undefined }
  | { erro?: undefined; dados: { descricao: string; local: string; unidade: string; qtd_planejada: number } };

function lerAtividade(form: FormData): Leitura {
  const descricao = texto(form, "descricao");
  const unidade = texto(form, "unidade");
  const qtd = parseNumero(texto(form, "qtd_planejada"));
  const campos: Record<string, string> = {};
  if (!descricao) campos.descricao = "Informe a descrição";
  if (!unidade) campos.unidade = "Informe a unidade";
  if (qtd === null) campos.qtd_planejada = "Informe uma quantidade válida";
  else if (qtd <= 0) campos.qtd_planejada = "Quantidade deve ser maior que zero";
  if (Object.keys(campos).length > 0) return { erro: falhaForm(form, "Revise os campos.", campos) };
  return { dados: { descricao, local: texto(form, "local"), unidade, qtd_planejada: qtd as number } };
}

export async function adicionarAtividadeAcao(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const l = lerAtividade(form);
  if (l.erro !== undefined) return l.erro;
  const r = await adicionarAtividade(await criarClienteServidor(), texto(form, "turno_id"), l.dados);
  if (!r.ok) return falhaForm(form, r.erro);
  atualizar();
  return ok(undefined);
}

export async function editarAtividadeAcao(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const l = lerAtividade(form);
  if (l.erro !== undefined) return l.erro;
  // Apenas campos de planejamento; origem_id e demais nunca vêm do formulário.
  const r = await editarAtividade(await criarClienteServidor(), texto(form, "atividade_id"), l.dados);
  if (!r.ok) return falhaForm(form, r.erro);
  atualizar();
  return ok(undefined);
}

export async function removerAtividadeAcao(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const r = await removerAtividade(await criarClienteServidor(), texto(form, "atividade_id"));
  if (!r.ok) return falha(r.erro);
  atualizar();
  return ok(undefined);
}

export async function moverAtividadeAcao(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const direcao = texto(form, "direcao");
  if (direcao !== "cima" && direcao !== "baixo") return falha("Direção inválida");
  const r = await moverAtividade(await criarClienteServidor(), texto(form, "atividade_id"), direcao);
  if (!r.ok) return falha(r.erro);
  atualizar();
  return ok(undefined);
}

export async function trazerPendentesAcao(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const r = await trazerPendentes(await criarClienteServidor(), texto(form, "turno_id"));
  if (!r.ok) return falha(r.erro);
  atualizar();
  const n = r.dados.adicionadas;
  return ok({
    mensagem: n === 0 ? "Nenhuma atividade pendente nova" : `${n} atividade${n > 1 ? "s" : ""} trazida${n > 1 ? "s" : ""}`,
  });
}
