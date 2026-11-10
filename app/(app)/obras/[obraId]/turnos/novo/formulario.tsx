"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao, classesBotao } from "@/components/ui/Botao";
import { CamposTurno, turnoPadrao } from "../CamposTurno";
import { novoTurno, type EstadoNovoTurno } from "./acoes";

export function FormNovoTurno({ obraId, hoje }: { obraId: string; hoje: string }) {
  const [estado, action, pendente] = useActionState<EstadoNovoTurno, FormData>(novoTurno, null);
  const erro = estado && !estado.ok ? estado : null;
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="obra_id" value={obraId} />
      <CamposTurno inicial={turnoPadrao(hoje)} valores={erro?.valores} envio={erro?.envio} />
      {erro && <Aviso tom="perigo">{erro.erro}</Aviso>}
      <Botao type="submit" carregando={pendente}>Criar turno</Botao>
      <Link href={`/obras/${obraId}`} className={classesBotao("secundario")}>Cancelar</Link>
    </form>
  );
}
