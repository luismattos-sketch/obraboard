"use client";

import { useActionState, useId, useState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Botao } from "@/components/ui/Botao";
import { Campo } from "@/components/ui/Campo";
import { formatarData } from "@/lib/dominio/formato";
import { ordenarRestricoes, restricaoVencida, type Restricao } from "@/lib/dominio/restricoes";
import { CAUSAS, type Causa } from "@/lib/dominio/tipos";
import { apagarRestricaoAcao, marcarRemovidaAcao, salvarRestricaoAcao, type EstadoLookahead } from "./acoes";

const diaMes = (iso: string) => formatarData(iso).slice(0, 5);

/** Formulário de nova restrição (sem `restricao`) ou de edição. Fecha sozinho quando salva. */
function FormRestricao({ itemId, restricao, sugestoes, aoFechar }: {
  itemId: string; restricao?: Restricao; sugestoes: string[]; aoFechar: () => void;
}) {
  const lista = useId();
  const [estado, action, pendente] = useActionState<EstadoLookahead, FormData>(async (anterior, form) => {
    const r = await salvarRestricaoAcao(anterior, form);
    if (r?.ok) aoFechar();
    return r;
  }, null);
  const erros = estado && !estado.ok ? estado.campos ?? {} : {};
  return (
    <form action={action} className="flex flex-col gap-2 rounded-botao border border-borda p-3">
      <input type="hidden" name="item_id" value={itemId} />
      {restricao && <input type="hidden" name="restricao_id" value={restricao.id} />}
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Tipo
        <select name="tipo" defaultValue={restricao?.tipo ?? ""} required
          className="min-h-12 rounded-botao border border-borda bg-white px-3 font-normal">
          <option value="" disabled>Escolha…</option>
          {(Object.keys(CAUSAS) as Causa[]).map((c) => <option key={c} value={c}>{CAUSAS[c]}</option>)}
        </select>
        {erros.tipo && <span className="text-perigo">{erros.tipo}</span>}
      </label>
      <Campo rotulo="Descrição" name="descricao" maxLength={300} required defaultValue={restricao?.descricao}
        placeholder="Ex.: PT da área 2 não emitida" erro={erros.descricao} />
      <Campo rotulo="Responsável" name="responsavel" maxLength={100} required list={lista} defaultValue={restricao?.responsavel}
        placeholder="Quem tem de destravar" erro={erros.responsavel} />
      <datalist id={lista}>{sugestoes.map((s) => <option key={s} value={s} />)}</datalist>
      <Campo rotulo="Prazo (opcional)" name="prazo" type="date" defaultValue={restricao?.prazo ?? ""} erro={erros.prazo} />
      {estado && !estado.ok && !Object.keys(erros).length && <Aviso tom="perigo">{estado.erro}</Aviso>}
      <div className="flex gap-2">
        <Botao type="submit" carregando={pendente}>Salvar</Botao>
        <Botao type="button" variante="discreto" onClick={aoFechar}>Cancelar</Botao>
      </div>
    </form>
  );
}

function LinhaRestricao({ itemId, r, hoje, sugestoes }: { itemId: string; r: Restricao; hoje: string; sugestoes: string[] }) {
  const [editando, setEditando] = useState(false);
  const [, acaoMarcar, marcando] = useActionState<EstadoLookahead, FormData>(marcarRemovidaAcao, null);
  const [, acaoApagar, apagando] = useActionState<EstadoLookahead, FormData>(apagarRestricaoAcao, null);
  if (editando) return <FormRestricao itemId={itemId} restricao={r} sugestoes={sugestoes} aoFechar={() => setEditando(false)} />;
  const vencida = restricaoVencida(r, hoje);
  return (
    <li className="flex flex-col gap-1 py-2">
      <p className={r.removida_em ? "text-texto-suave line-through" : "font-semibold"}>{r.descricao}</p>
      <p className="text-sm text-texto-suave">
        {CAUSAS[r.tipo]} · {r.responsavel}
        {r.prazo && <span className={vencida ? "font-semibold text-perigo" : ""}> · prazo {diaMes(r.prazo)}{vencida ? " (vencida)" : ""}</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        <form action={acaoMarcar}>
          <input type="hidden" name="restricao_id" value={r.id} />
          <input type="hidden" name="removida" value={r.removida_em ? "0" : "1"} />
          <Botao type="submit" variante="secundario" carregando={marcando}>{r.removida_em ? "Reabrir" : "Removida"}</Botao>
        </form>
        {!r.removida_em && <Botao type="button" variante="discreto" onClick={() => setEditando(true)}>Editar</Botao>}
        <form action={acaoApagar} onSubmit={(e) => { if (!confirm("Apagar esta restrição?")) e.preventDefault(); }}>
          <input type="hidden" name="restricao_id" value={r.id} />
          <Botao type="submit" variante="discreto" carregando={apagando}>Apagar</Botao>
        </form>
      </div>
    </li>
  );
}

/** Item 5.2: restrições de um item do lookahead (abre e fecha no cartão do item). */
export function Restricoes({ itemId, restricoes, hoje, sugestoes }: {
  itemId: string; restricoes: Restricao[]; hoje: string; sugestoes: string[];
}) {
  const [aberto, setAberto] = useState(false);
  const [novo, setNovo] = useState(false);
  const ordenadas = ordenarRestricoes(restricoes);
  const abertas = ordenadas.filter((r) => !r.removida_em);
  const removidas = ordenadas.filter((r) => r.removida_em);
  if (!aberto) {
    return (
      <Botao type="button" variante="discreto" aria-expanded={false} onClick={() => setAberto(true)}>
        Restrições ({abertas.length})
      </Botao>
    );
  }
  return (
    <div className="flex w-full flex-col gap-2 border-t border-borda pt-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Restrições</h3>
        <Botao type="button" variante="discreto" aria-expanded onClick={() => setAberto(false)}>Fechar</Botao>
      </div>
      {abertas.length === 0 && <p className="text-sm text-texto-suave">Nenhuma restrição aberta.</p>}
      <ul className="divide-y divide-borda">
        {abertas.map((r) => <LinhaRestricao key={r.id} itemId={itemId} r={r} hoje={hoje} sugestoes={sugestoes} />)}
      </ul>
      {novo ? (
        <FormRestricao itemId={itemId} sugestoes={sugestoes} aoFechar={() => setNovo(false)} />
      ) : (
        <Botao type="button" variante="secundario" onClick={() => setNovo(true)}>Adicionar restrição</Botao>
      )}
      {removidas.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer">Removidas ({removidas.length})</summary>
          <ul className="divide-y divide-borda">
            {removidas.map((r) => <LinhaRestricao key={r.id} itemId={itemId} r={r} hoje={hoje} sugestoes={sugestoes} />)}
          </ul>
        </details>
      )}
    </div>
  );
}
