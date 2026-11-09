"use server";

import { redirect } from "next/navigation";
import { falha, type Resultado } from "@/lib/db/resultado";

export type EstadoNovoTurno = (Resultado<undefined> & { valores?: Record<string, string>; envio?: number }) | null;
import { criarTurno } from "@/lib/db/turnos";
import type { Periodo } from "@/lib/dominio/tipos";
import { criarClienteServidor } from "@/lib/supabase/servidor";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function novoTurno(_: EstadoNovoTurno, form: FormData): Promise<EstadoNovoTurno> {
  const valores: Record<string, string> = {};
  for (const k of ["data", "periodo", "hora_inicio_prevista", "hora_fim_prevista"]) valores[k] = texto(form, k);
  const erroForm = (e: string): EstadoNovoTurno => ({ ...falha(e), valores, envio: Date.now() });
  const periodo = texto(form, "periodo");
  if (periodo !== "diurno" && periodo !== "noturno") return erroForm("Escolha o período");
  const supabase = await criarClienteServidor();
  const r = await criarTurno(supabase, {
    obra_id: texto(form, "obra_id"),
    data: texto(form, "data"),
    periodo: periodo as Periodo,
    hora_inicio_prevista: texto(form, "hora_inicio_prevista") || null,
    hora_fim_prevista: texto(form, "hora_fim_prevista") || null,
  });
  if (!r.ok) return erroForm(r.erro);
  redirect(`/obras/${r.dados.obra_id}/turnos/${r.dados.id}`);
}
