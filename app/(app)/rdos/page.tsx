import { BaixarLote } from "@/components/rdo/BaixarLote";
import { FiltrosRdo } from "@/components/rdo/FiltrosRdo";
import { ListaRdos } from "@/components/rdo/ListaRdos";
import { Aviso } from "@/components/ui/Aviso";
import { listarObras } from "@/lib/db/obras";
import { listarVersoes } from "@/lib/db/rdo-versoes";
import { agruparVersoes, mesesDisponiveis, normalizarMes, type ItemVersao } from "@/lib/dominio/historico-rdo";
import { criarClienteServidor } from "@/lib/supabase/servidor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RdosPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const mes = normalizarMes(sp.mes);
  const obra = typeof sp.obra === "string" && UUID.test(sp.obra) ? sp.obra : null;
  const supabase = await criarClienteServidor();

  let itens: ItemVersao[] | null = null;
  let obras: { id: string; nome: string }[] = [];
  try {
    const [vs, os] = await Promise.all([listarVersoes(supabase, obra ? { obraId: obra } : {}), listarObras(supabase)]);
    itens = vs;
    obras = os.map((o) => ({ id: o.id, nome: o.nome }));
  } catch {
    itens = null;
  }

  const grupos = itens ? agruparVersoes(itens, mes) : [];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <h1 className="text-titulo font-semibold text-primaria">RDOs</h1>
      {itens === null ? (
        <Aviso tom="perigo">Não foi possível carregar os RDOs. Tente novamente.</Aviso>
      ) : (
        <>
          <FiltrosRdo acao="/rdos" meses={mesesDisponiveis(itens)} mes={mes} obras={obras} obra={obra} />
          <BaixarLote mes={mes} quantidade={grupos.length} obraId={obra} />
          <ListaRdos grupos={grupos} mostrarObra filtrado={mes !== null || obra !== null} />
        </>
      )}
    </div>
  );
}
