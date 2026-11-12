"use server";

import { revalidatePath } from "next/cache";
import {
  encerrarSemana,
  programarSemana,
  reabrirSemana,
  removerAtividadeProgramada,
  salvarAtividadeProgramada,
} from "@/lib/db/programacao";
import { falha, ok, type Resultado } from "@/lib/db/resultado";
import { causaValida } from "@/lib/db/validacao";
import { parseNumero } from "@/lib/dominio/entrada";
import type { DiaSemana, Semana } from "@/lib/dominio/programacao";
import type { Causa, Periodo } from "@/lib/dominio/tipos";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export type EstadoSemana = (Resultado<undefined> & { envio?: number }) | null;

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function atualizar() {
  revalidatePath("/obras/[obraId]/programacao/[inicio]", "page");
  revalidatePath("/obras/[obraId]/programacao", "page");
}

export async function salvarAtividadeProgramadaAcao(_: EstadoSemana, form: FormData): Promise<EstadoSemana> {
  const funcoes = form.getAll("funcao").map((v) => String(v).trim());
  const quantidades = form.getAll("quantidade").map((v) => String(v).trim());
  const equipe = funcoes
    .map((funcao, i) => ({ funcao, qtd: quantidades[i] ?? "" }))
    .filter((l) => l.funcao || l.qtd)
    .map((l) => ({ funcao: l.funcao, quantidade: /^\d+$/.test(l.qtd) ? Number(l.qtd) : NaN }));
  const meta = parseNumero(texto(form, "meta"));
  const id = texto(form, "atividade_id") || undefined;
  const r = await salvarAtividadeProgramada(
    await criarClienteServidor(),
    texto(form, "semana_id"),
    {
      descricao: texto(form, "descricao"),
      local: texto(form, "local"),
      unidade: texto(form, "unidade"),
      meta: meta ?? NaN,
      dias: form.getAll("dias").map((d) => Number(d) as DiaSemana),
      periodo: texto(form, "periodo") as Periodo,
      equipe,
      responsavel_id: texto(form, "responsavel_id") || null,
    },
    id,
  );
  if (!r.ok) return { ...falha(r.erro, r.campos), envio: Date.now() };
  atualizar();
  return { ...ok(undefined), envio: Date.now() };
}

export async function removerAtividadeProgramadaAcao(_: EstadoSemana, form: FormData): Promise<EstadoSemana> {
  const r = await removerAtividadeProgramada(await criarClienteServidor(), texto(form, "atividade_id"));
  if (!r.ok) return falha(r.erro);
  atualizar();
  return ok(undefined);
}

export async function programarSemanaAcao(_: EstadoSemana, form: FormData): Promise<EstadoSemana> {
  const r = await programarSemana(await criarClienteServidor(), texto(form, "semana_id"));
  if (!r.ok) return falha(r.erro);
  atualizar();
  return ok(undefined);
}

export async function encerrarSemanaAcao(_: EstadoSemana, form: FormData): Promise<EstadoSemana> {
  const c = await criarClienteServidor();
  const { data } = await c
    .from("semanas")
    .select("id, obra_id, inicio, status, programada_em, encerrada_em, motivo_reabertura")
    .eq("id", texto(form, "semana_id"))
    .maybeSingle();
  if (!data) return falha("Semana não encontrada");
  const causas: Record<string, Causa> = {};
  for (const [k, v] of form.entries()) {
    if (k.startsWith("causa:") && causaValida(v)) causas[k.slice("causa:".length)] = v as Causa;
  }
  const r = await encerrarSemana(c, data as Semana, causas);
  if (!r.ok) return falha(r.erro);
  atualizar();
  return ok(undefined);
}

export async function reabrirSemanaAcao(_: EstadoSemana, form: FormData): Promise<EstadoSemana> {
  const r = await reabrirSemana(await criarClienteServidor(), texto(form, "semana_id"), form.get("motivo"));
  if (!r.ok) return { ...falha(r.erro), envio: Date.now() };
  atualizar();
  return ok(undefined);
}
