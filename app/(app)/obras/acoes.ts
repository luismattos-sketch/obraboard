"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { falha, type Resultado } from "@/lib/db/resultado";
import { criarObra, errosObra } from "@/lib/db/obras";
import { validarCidade } from "@/lib/db/validacao";
import { criarClienteServidor } from "@/lib/supabase/servidor";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function novaObra(_: Resultado<undefined> | null, form: FormData): Promise<Resultado<undefined>> {
  const base = { nome: texto(form, "nome"), cliente: texto(form, "cliente"), endereco: texto(form, "endereco") };
  const campos = errosObra(base);
  if (!base.nome) campos.nome = "Informe o nome da obra";
  const lat = texto(form, "cidade_lat"), lon = texto(form, "cidade_lon");
  const cidade = validarCidade({ nome: texto(form, "cidade_nome"), latitude: lat ? Number(lat) : undefined, longitude: lon ? Number(lon) : undefined });
  if (!cidade.ok) campos.cidade = cidade.erro;
  const dados = { ...base, cidade: cidade.ok ? cidade.dados : undefined };
  if (Object.keys(campos).length > 0) return falha("Revise os campos.", campos);

  const supabase = await criarClienteServidor();
  const r = await criarObra(supabase, dados);
  if (!r.ok) return falha(r.erro, r.campos);
  // O menu lateral (no layout) lista as obras: recarrega para a nova aparecer.
  revalidatePath("/obras", "layout");
  redirect(`/obras/${r.dados.id}`);
}
