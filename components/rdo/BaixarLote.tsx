import { classesBotao } from "@/components/ui/Botao";
import { Aviso } from "@/components/ui/Aviso";
import { LIMITE_LOTE } from "@/lib/dominio/lote-rdo";

/** Link para o PDF único do mês filtrado (sem JavaScript: é só um download). */
export function BaixarLote({ mes, quantidade, obraId }: { mes: string | null; quantidade: number; obraId?: string | null }) {
  if (!mes || quantidade === 0) return null;
  if (quantidade > LIMITE_LOTE) {
    return (
      <Aviso tom="info">
        {`Muitos RDOs neste filtro (${quantidade}). Escolha uma obra para baixar em PDF único.`}
      </Aviso>
    );
  }
  const q = new URLSearchParams({ mes });
  if (obraId) q.set("obra", obraId);
  return (
    <div>
      <a href={`/api/rdo/lote?${q}`} className={classesBotao("primario")}>
        {quantidade === 1 ? "Baixar o RDO (PDF único)" : `Baixar os ${quantidade} RDOs (PDF único)`}
      </a>
    </div>
  );
}
