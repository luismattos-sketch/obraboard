"use server";

import { redirect } from "next/navigation";
import { falha, type Resultado } from "@/lib/db/resultado";
import { criarTurno } from "@/lib/db/turnos";
import type { Periodo } from "@/lib/dominio/tipos";
import { criarClienteServidor } from "@/lib/supabase/servidor";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function novoTurno(_: Resultado<undefined> | null, form: FormData): Promise<Resultado<undefined>> {
  const periodo = texto(form, "periodo");
  if (periodo !== "diurno" && periodo !== "noturno") return falha("Escolha o período");
  const supabase = await criarClienteServidor();
  const r = await criarTurno(supabase, {
    obra_id: texto(form, "obra_id"),
    data: texto(form, "data"),
    periodo: periodo as Periodo,
    hora_inicio_prevista: texto(form, "hora_inicio_prevista") || null,
    hora_fim_prevista: texto(form, "hora_fim_prevista") || null,
  });
  if (!r.ok) return falha(r.erro);
  redirect(`/obras/${r.dados.obra_id}/turnos/${r.dados.id}`);
}
