"use server";

import { redirect } from "next/navigation";
import { criarTurno } from "@/lib/db/turnos";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { lerFormTurno, type EstadoFormTurno } from "../formTurno";

export type EstadoNovoTurno = EstadoFormTurno;

export async function novoTurno(_: EstadoNovoTurno, form: FormData): Promise<EstadoNovoTurno> {
  const { dados, falhar } = lerFormTurno(form);
  if (!dados) return falhar("Escolha o período");
  const supabase = await criarClienteServidor();
  const r = await criarTurno(supabase, { ...dados, obra_id: String(form.get("obra_id") ?? "").trim() });
  if (!r.ok) return falhar(r.erro);
  redirect(`/obras/${r.dados.obra_id}/turnos/${r.dados.id}`);
}
