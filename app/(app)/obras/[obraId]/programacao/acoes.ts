"use server";

import { redirect } from "next/navigation";
import { criarRascunho } from "@/lib/db/programacao";
import { falha, type Resultado } from "@/lib/db/resultado";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export type EstadoAbrir = Resultado<undefined> | null;

/** Cria (ou reabre, se já existir) a semana que contém a data e vai para ela. */
export async function abrirSemanaAcao(_: EstadoAbrir, form: FormData): Promise<EstadoAbrir> {
  const obraId = String(form.get("obra_id") ?? "").trim();
  const data = String(form.get("data") ?? "").trim();
  const r = await criarRascunho(await criarClienteServidor(), obraId, data);
  if (!r.ok) return falha(r.erro);
  redirect(`/obras/${r.dados.obra_id}/programacao/${r.dados.inicio}`);
}
