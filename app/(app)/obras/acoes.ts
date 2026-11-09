"use server";

import { redirect } from "next/navigation";
import { falha, type Resultado } from "@/lib/db/resultado";
import { criarObra, errosObra } from "@/lib/db/obras";
import { criarClienteServidor } from "@/lib/supabase/servidor";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function novaObra(_: Resultado<undefined> | null, form: FormData): Promise<Resultado<undefined>> {
  const dados = { nome: texto(form, "nome"), cliente: texto(form, "cliente"), endereco: texto(form, "endereco") };
  const campos = errosObra(dados);
  if (!dados.nome) campos.nome = "Informe o nome da obra";
  if (Object.keys(campos).length > 0) return falha("Revise os campos.", campos);

  const supabase = await criarClienteServidor();
  const r = await criarObra(supabase, dados);
  if (!r.ok) return falha(r.erro, r.campos);
  redirect(`/obras/${r.dados.id}`);
}
