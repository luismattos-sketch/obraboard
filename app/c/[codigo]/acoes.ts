"use server";

import { revalidatePath } from "next/cache";
import { registrarCiencia } from "@/lib/db/ciencia";
import type { Resultado } from "@/lib/db/resultado";

export async function registrarCienciaAcao(codigo: string, ids: string[], nome: string): Promise<Resultado<{ registradas: number }>> {
  const r = await registrarCiencia(codigo, ids, nome);
  if (r.ok) revalidatePath(`/c/${codigo}`);
  return r;
}
