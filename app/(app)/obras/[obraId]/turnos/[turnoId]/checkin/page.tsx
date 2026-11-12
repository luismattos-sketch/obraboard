import Link from "next/link";
import { notFound } from "next/navigation";
import { Quadro } from "@/components/quadro/Quadro";
import { fotoCheckin } from "@/lib/db/quadro";
import { montarQuadro } from "@/lib/dominio/quadro";
import { dataHoraCurta } from "@/lib/rdo/formatar";
import { criarClienteServidor } from "@/lib/supabase/servidor";

/** Foto oficial do check-in (o que foi combinado ao liberar o turno), só leitura. */
export default async function FotoCheckin({ params }: { params: Promise<{ obraId: string; turnoId: string }> }) {
  const { obraId, turnoId } = await params;
  const supabase = await criarClienteServidor();
  const foto = await fotoCheckin(supabase, turnoId);
  if (!foto || foto.dados.obra.id !== obraId) notFound();

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Link href={`/obras/${obraId}/turnos/${turnoId}`} className="text-sm text-operacional underline">← Turno</Link>
      <p className="text-sm text-texto-suave">{`Check-in registrado em ${dataHoraCurta(new Date(foto.emitido_em))}`}</p>
      <Quadro modelo={montarQuadro(foto.dados)} visao="checkin" publico={false} editarHref={null} />
    </div>
  );
}
