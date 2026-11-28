"use client";

import { useActionState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import type { ItemCronograma } from "@/lib/dominio/cronograma";
import { formatarData, numeroBR } from "@/lib/dominio/formato";
import { apagarItemManualAcao, levarParaSemanaAcao, type EstadoLookahead } from "./acoes";
import { FormItemManual } from "./FormItemManual";
import { Restricoes } from "./Restricoes";
import { resumoRestricoes, type Restricao } from "@/lib/dominio/restricoes";

const diaMes = (iso: string) => formatarData(iso).slice(0, 5);

export function ItemLookahead({
  obraId,
  item,
  segunda,
  semanasLevadas,
  mudou,
  podeLevar,
  restricoes,
  hoje,
  sugestoes,
}: {
  obraId: string;
  item: ItemCronograma;
  segunda: string;
  semanasLevadas: string[];
  mudou: boolean;
  podeLevar: boolean;
  restricoes: Restricao[];
  hoje: string;
  sugestoes: string[];
}) {
  const { abertas, vencidas } = resumoRestricoes(restricoes, hoje);
  const [levar, acaoLevar, levando] = useActionState<EstadoLookahead, FormData>(levarParaSemanaAcao, null);
  const [apagar, acaoApagar, apagando] = useActionState<EstadoLookahead, FormData>(apagarItemManualAcao, null);
  const erro = (levar && !levar.ok && levar.erro) || (apagar && !apagar.ok && apagar.erro);
  return (
    <Cartao>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold">{item.descricao}</p>
            <p className="text-sm text-texto-suave">
              {[item.codigo, `${diaMes(item.inicio)} – ${diaMes(item.fim)}`, item.local,
                item.quantidade !== null ? `${numeroBR(item.quantidade)} ${item.unidade ?? ""}`.trim() : null]
                .filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {item.origem === "manual" && <Selo tom="neutro">Manual</Selo>}
            {item.removido_em && <Selo tom="neutro">Saiu do cronograma</Selo>}
            {semanasLevadas.map((s) => (
              <Selo key={s} tom="info">Na semana de {diaMes(s)}</Selo>
            ))}
            {mudou && <Selo tom="alerta">Mudou desde que foi levado</Selo>}
            {vencidas > 0 ? (
              <Selo tom="perigo">{vencidas} {vencidas === 1 ? "vencida" : "vencidas"}</Selo>
            ) : abertas > 0 ? (
              <Selo tom="alerta">{abertas} {abertas === 1 ? "restrição aberta" : "restrições abertas"}</Selo>
            ) : null}
          </div>
        </div>
        {erro && <Aviso tom="perigo">{erro}</Aviso>}
        <div className="flex flex-wrap items-center gap-2">
          <form action={acaoLevar}>
            <input type="hidden" name="item_id" value={item.id} />
            <input type="hidden" name="segunda" value={segunda} />
            <Botao type="submit" variante="secundario" carregando={levando} disabled={!podeLevar}>
              {podeLevar ? "Levar para esta semana" : "Semana já programada"}
            </Botao>
          </form>
          <Restricoes itemId={item.id} restricoes={restricoes} hoje={hoje} sugestoes={sugestoes} />
          {item.origem === "manual" && (
            <>
              <FormItemManual obraId={obraId} item={item} />
              <form action={acaoApagar} onSubmit={(e) => { if (!confirm("Apagar este item do lookahead?")) e.preventDefault(); }}>
                <input type="hidden" name="item_id" value={item.id} />
                <Botao type="submit" variante="discreto" carregando={apagando}>Apagar</Botao>
              </form>
            </>
          )}
        </div>
      </div>
    </Cartao>
  );
}
