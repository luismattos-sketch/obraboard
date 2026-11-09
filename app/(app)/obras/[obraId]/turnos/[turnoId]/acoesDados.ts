"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { falha, ok, type Resultado } from "@/lib/db/resultado";
import { editarTurno, removerTurno } from "@/lib/db/turnos";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { lerFormTurno, type EstadoFormTurno } from "../formTurno";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Edita data/período/horários previstos de um turno planejado. */
export async function editarDadosTurnoAcao(_: EstadoFormTurno, form: FormData): Promise<EstadoFormTurno> {
  const { dados, falhar } = lerFormTurno(form);
  if (!dados) return falhar("Escolha o período");
  const r = await editarTurno(await criarClienteServidor(), texto(form, "turno_id"), dados);
  if (!r.ok) return falhar(r.erro);
  revalidatePath(`/obras/${r.dados.obra_id}/turnos/${r.dados.id}`);
  revalidatePath(`/obras/${r.dados.obra_id}`);
  return ok(undefined);
}

/** Exclui um turno planejado (e suas atividades) e volta para a obra. */
export async function excluirTurnoAcao(_: Resultado<undefined> | null, form: FormData): Promise<Resultado<undefined>> {
  const turnoId = texto(form, "turno_id");
  const c = await criarClienteServidor();
  // O obra_id vem do turno (RLS), nunca do formulário.
  const { data } = await c.from("turnos").select("obra_id").eq("id", turnoId).maybeSingle();
  const obraId = (data as { obra_id: string } | null)?.obra_id;
  if (!obraId) return falha("Turno não encontrado");
  const r = await removerTurno(c, turnoId);
  if (!r.ok) return r;
  revalidatePath(`/obras/${obraId}`);
  redirect(`/obras/${obraId}`);
}
