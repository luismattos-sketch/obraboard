import { Botao } from "@/components/ui/Botao";
import { rotuloMes } from "@/lib/dominio/historico-rdo";

type Props = {
  acao: string;
  meses: string[];
  mes: string | null;
  obras?: { id: string; nome: string }[];
  obra?: string | null;
};

const classeSelect =
  "min-h-11 rounded-botao border border-borda bg-superficie px-3 text-base text-texto focus-visible:outline-2 focus-visible:outline-operacional";

/** Filtros na query (?mes=, ?obra=): formulário GET, funciona sem JavaScript. */
export function FiltrosRdo({ acao, meses, mes, obras, obra }: Props) {
  // Mês pedido na URL sem RDO: continua aparecendo selecionado (a lista sai vazia).
  const opcoes = mes && !meses.includes(mes) ? [mes, ...meses] : meses;
  return (
    <form method="get" action={acao} className="flex flex-wrap items-end gap-3">
      {obras && (
        <label className="flex flex-col gap-1 text-sm font-medium text-texto">
          Obra
          <select name="obra" defaultValue={obra ?? ""} className={classeSelect}>
            <option value="">Todas</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>{o.nome}</option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium text-texto">
        Mês
        <select name="mes" defaultValue={mes ?? ""} className={classeSelect}>
          <option value="">Todos</option>
          {opcoes.map((m) => (
            <option key={m} value={m}>{rotuloMes(m)}</option>
          ))}
        </select>
      </label>
      <Botao type="submit" variante="secundario">Filtrar</Botao>
    </form>
  );
}
