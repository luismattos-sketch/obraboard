import { notFound } from "next/navigation";
import { Cartao } from "@/components/ui/Cartao";
import { obterObra } from "@/lib/db/obras";
import { hojeSaoPaulo } from "@/lib/dominio/entrada";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { FormNovoTurno } from "./formulario";

export default async function NovoTurnoPage({ params }: { params: Promise<{ obraId: string }> }) {
  const { obraId } = await params;
  const obra = await obterObra(await criarClienteServidor(), obraId);
  if (!obra) notFound();
  return (
    <Cartao className="mx-auto w-full max-w-lg">
      <h1 className="text-xl font-semibold text-primaria">Novo turno</h1>
      <p className="mb-4 text-sm text-texto-suave">{obra.nome}</p>
      <FormNovoTurno obraId={obra.id} hoje={hojeSaoPaulo()} />
    </Cartao>
  );
}
