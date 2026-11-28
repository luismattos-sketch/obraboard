"use client";

import { useActionState, useState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import { Campo } from "@/components/ui/Campo";
import type { ItemCronograma } from "@/lib/dominio/cronograma";
import { numeroBR } from "@/lib/dominio/formato";
import { salvarItemManualAcao, type EstadoLookahead } from "./acoes";

/** "Adicionar item" (sem `item`) ou "Editar" de um item manual. */
export function FormItemManual({ obraId, item }: { obraId: string; item?: ItemCronograma }) {
  // Aberto desde `abertoEm`; fecha sozinho quando um envio posterior deu certo.
  const [abertoEm, setAbertoEm] = useState<number | null>(null);
  const [estado, action, pendente] = useActionState<EstadoLookahead, FormData>(salvarItemManualAcao, null);
  const aberto = abertoEm !== null && !(estado?.ok && (estado.envio ?? 0) > abertoEm);
  const setAberto = (v: boolean) => setAbertoEm(v ? Date.now() : null);

  if (!aberto) {
    return (
      <Botao type="button" variante={item ? "discreto" : "secundario"} onClick={() => setAberto(true)}>
        {item ? "Editar" : "Adicionar item"}
      </Botao>
    );
  }
  const erros = estado && !estado.ok ? estado.campos ?? {} : {};
  return (
    <form action={action} className="flex w-full flex-col gap-3 rounded-botao border border-borda p-3">
      <input type="hidden" name="obra_id" value={obraId} />
      {item && <input type="hidden" name="item_id" value={item.id} />}
      <Campo rotulo="Descrição" name="descricao" defaultValue={item?.descricao} required maxLength={500} erro={erros.descricao} />
      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="Início" name="inicio" type="date" defaultValue={item?.inicio} required erro={erros.inicio} />
        <Campo rotulo="Término" name="fim" type="date" defaultValue={item?.fim} required erro={erros.fim} />
      </div>
      <Campo rotulo="Local (opcional)" name="local" defaultValue={item?.local ?? ""} />
      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="Quantidade (opcional)" name="quantidade" inputMode="decimal"
          defaultValue={item?.quantidade !== null && item?.quantidade !== undefined ? numeroBR(item.quantidade) : ""} erro={erros.quantidade} />
        <Campo rotulo="Unidade (opcional)" name="unidade" defaultValue={item?.unidade ?? ""} />
      </div>
      {estado && !estado.ok && !Object.keys(erros).length && <Aviso tom="perigo">{estado.erro}</Aviso>}
      <div className="flex gap-2">
        <Botao type="submit" carregando={pendente}>Salvar</Botao>
        <Botao type="button" variante="discreto" onClick={() => setAberto(false)}>Cancelar</Botao>
      </div>
    </form>
  );
}
