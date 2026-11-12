import Link from "next/link";
import { notFound } from "next/navigation";
import { AtualizarPeriodicamente } from "@/components/quadro/AtualizarPeriodicamente";
import { prepararQuadro } from "@/components/quadro/prepararQuadro";
import { Quadro } from "@/components/quadro/Quadro";
import { Cartao } from "@/components/ui/Cartao";
import { obterObra } from "@/lib/db/obras";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export default async function QuadroPlanejador({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const [{ obraId }, busca] = await Promise.all([params, searchParams]);
  const supabase = await criarClienteServidor();
  const obra = await obterObra(supabase, obraId);
  if (!obra) notFound();
  const q = await prepararQuadro(supabase, obra.id, busca, `/obras/${obra.id}/quadro`);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Link href={`/obras/${obra.id}`} className="text-sm text-operacional underline">← {obra.nome}</Link>
      {q ? (
        <>
          <Quadro {...q.props} publico={false} editarHref={`/obras/${obra.id}/turnos/${q.turnoId}`} />
          <AtualizarPeriodicamente />
        </>
      ) : (
        <Cartao><p className="text-texto-suave">Nenhum turno ainda</p></Cartao>
      )}
    </div>
  );
}
