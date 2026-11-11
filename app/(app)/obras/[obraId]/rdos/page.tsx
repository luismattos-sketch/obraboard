import Link from "next/link";
import { notFound } from "next/navigation";
import { FiltrosRdo } from "@/components/rdo/FiltrosRdo";
import { ListaRdos } from "@/components/rdo/ListaRdos";
import { Aviso } from "@/components/ui/Aviso";
import { obterObra } from "@/lib/db/obras";
import { listarVersoes } from "@/lib/db/rdo-versoes";
import { agruparVersoes, mesesDisponiveis, normalizarMes, type ItemVersao } from "@/lib/dominio/historico-rdo";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export default async function RdosObraPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const { obraId } = await params;
  const mes = normalizarMes((await searchParams).mes);
  const supabase = await criarClienteServidor();
  const obra = await obterObra(supabase, obraId);
  if (!obra) notFound();

  let itens: ItemVersao[] | null = null;
  try {
    itens = await listarVersoes(supabase, { obraId: obra.id });
  } catch {
    itens = null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="min-w-0">
        <Link href={`/obras/${obra.id}`} className="text-sm text-texto-suave hover:underline">
          ← {obra.nome}
        </Link>
        <h1 className="text-titulo font-semibold text-primaria">RDOs</h1>
      </div>
      {itens === null ? (
        <Aviso tom="perigo">Não foi possível carregar os RDOs. Tente novamente.</Aviso>
      ) : (
        <>
          <FiltrosRdo acao={`/obras/${obra.id}/rdos`} meses={mesesDisponiveis(itens)} mes={mes} />
          <ListaRdos grupos={agruparVersoes(itens, mes)} mostrarObra={false} filtrado={mes !== null} />
        </>
      )}
    </div>
  );
}
