import Link from "next/link";
import { notFound } from "next/navigation";
import { classesBotao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import { obterObra } from "@/lib/db/obras";
import { listarTurnosComAtividades } from "@/lib/db/turnos";
import { percentualCumprimento } from "@/lib/dominio/calculos";
import { dataBR, ROTULO_PERIODO, TOM_STATUS_TURNO } from "@/lib/dominio/formato";
import { ROTULO_STATUS_TURNO } from "@/lib/dominio/tipos";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export default async function ObraPage({ params }: { params: Promise<{ obraId: string }> }) {
  const { obraId } = await params;
  const supabase = await criarClienteServidor();
  const obra = await obterObra(supabase, obraId);
  if (!obra) notFound();
  const turnos = await listarTurnosComAtividades(supabase, obraId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-primaria">{obra.nome}</h1>
          {obra.cliente && <p className="text-sm text-texto-suave">{obra.cliente}</p>}
        </div>
        <Link href={`/obras/${obra.id}/turnos/novo`} className={classesBotao()}>Novo turno</Link>
      </div>

      {turnos.length === 0 ? (
        <Cartao>
          <p className="text-texto-suave">Nenhum turno ainda. Crie o primeiro para planejar as atividades.</p>
        </Cartao>
      ) : (
        <ul className="flex flex-col gap-3">
          {turnos.map((t) => {
            const pct = t.status === "planejado" ? null : percentualCumprimento(t.atividades);
            return (
              <li key={t.id}>
                <Link
                  href={`/obras/${obra.id}/turnos/${t.id}`}
                  className="block rounded-xl focus-visible:outline-2 focus-visible:outline-primaria"
                >
                  <Cartao className="flex items-center justify-between gap-3 transition-colors hover:bg-primaria-clara">
                    <div>
                      <p className="font-semibold text-texto">{dataBR(t.data)}</p>
                      <p className="text-sm text-texto-suave">{ROTULO_PERIODO[t.periodo]}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {pct !== null && (
                        <span className="text-sm font-semibold text-texto">{Math.round(pct * 100)}% de cumprimento</span>
                      )}
                      <Selo tom={TOM_STATUS_TURNO[t.status]}>{ROTULO_STATUS_TURNO[t.status]}</Selo>
                    </div>
                  </Cartao>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
