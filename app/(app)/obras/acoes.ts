"use server";

import { redirect } from "next/navigation";
import { falha, type Resultado } from "@/lib/db/resultado";
import { criarObra } from "@/lib/db/obras";
import { criarClienteServidor } from "@/lib/supabase/servidor";

const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function novaObra(_: Resultado<undefined> | null, form: FormData): Promise<Resultado<undefined>> {
  const nome = texto(form, "nome");
  if (!nome) return falha("Revise os campos.", { nome: "Informe o nome da obra" });

  const supabase = await criarClienteServidor();
  const r = await criarObra(supabase, {
    nome,
    cliente: texto(form, "cliente"),
    endereco: texto(form, "endereco"),
  });
  if (!r.ok) return falha(r.erro, r.campos);
  redirect(`/obras/${r.dados.id}`);
}
