"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao, classesBotao } from "@/components/ui/Botao";
import { Campo } from "@/components/ui/Campo";
import type { Resultado } from "@/lib/db/resultado";
import { novaObra } from "../acoes";

export function FormNovaObra() {
  const [estado, action, pendente] = useActionState<Resultado<undefined> | null, FormData>(novaObra, null);
  const erro = estado && !estado.ok ? estado : null;
  return (
    <form action={action} className="flex flex-col gap-4">
      {erro && !erro.campos && <Aviso tom="perigo">{erro.erro}</Aviso>}
      <Campo rotulo="Nome da obra" name="nome" required maxLength={120} erro={erro?.campos?.nome} />
      <Campo rotulo="Cliente (opcional)" name="cliente" maxLength={120} erro={erro?.campos?.cliente} />
      <Campo rotulo="Endereço (opcional)" name="endereco" autoComplete="street-address" maxLength={200} erro={erro?.campos?.endereco} />
      <Botao type="submit" carregando={pendente}>Criar obra</Botao>
      <Link href="/obras" className={classesBotao("secundario")}>Cancelar</Link>
    </form>
  );
}
