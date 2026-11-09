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

export type EstadoAcao = Resultado<{ mensagem?: string } | undefined> | null;

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function atualizar() {
  revalidatePath("/obras/[obraId]/turnos/[turnoId]", "page");
}

function lerPlanejada(form: FormData): { qtd?: number; erro?: Resultado<never> } {
  const qtd = parseNumero(texto(form, "qtd_planejada"));
  if (qtd === null || qtd <= 0) return { erro: falha("Quantidade deve ser maior que zero") };
  return { qtd };
}

export async function adicionarAtividadeAcao(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const q = lerPlanejada(form);
  if (q.erro) return q.erro;
  const r = await adicionarAtividade(await criarClienteServidor(), texto(form, "turno_id"), {
    descricao: texto(form, "descricao"),
    local: texto(form, "local"),
    unidade: texto(form, "unidade"),
    qtd_planejada: q.qtd!,
  });
  if (!r.ok) return falha(r.erro);
  atualizar();
  return ok(undefined);
}

export async function editarAtividadeAcao(_: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const q = lerPlanejada(form);
  if (q.erro) return q.erro;
  // Apenas campos de planejamento; origem_id e demais nunca vêm do formulário.
  const r = await editarAtividade(await criarClienteServidor(), texto(form, "atividade_id"), {
    descricao: texto(form, "descricao"),
    local: texto(form, "local"),
    unidade: texto(form, "unidade"),
    qtd_planejada: q.qtd!,
  });
  if (!r.ok) return falha(r.erro);
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
