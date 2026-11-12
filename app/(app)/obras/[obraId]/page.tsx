import Link from "next/link";
import { notFound } from "next/navigation";
import { classesBotao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import { obterObra } from "@/lib/db/obras";
import { listarResponsaveis } from "@/lib/db/responsaveis";
import { listarTurnosComAtividades } from "@/lib/db/turnos";
import { percentualCumprimento } from "@/lib/dominio/calculos";
import { formatarData, ROTULO_PERIODO, TOM_STATUS_TURNO } from "@/lib/dominio/formato";
import { ROTULO_STATUS_TURNO } from "@/lib/dominio/tipos";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { Responsaveis } from "./Responsaveis";

export default async function ObraPage({ params }: { params: Promise<{ obraId: string }> }) {
  const { obraId } = await params;
  const supabase = await criarClienteServidor();
  const obra = await obterObra(supabase, obraId);
  if (!obra) notFound();
  const [turnos, responsaveis] = await Promise.all([
    listarTurnosComAtividades(supabase, obraId),
    listarResponsaveis(supabase, obraId),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-titulo font-semibold text-primaria">{obra.nome}</h1>
          {obra.cliente && <p className="text-sm text-texto-suave">{obra.cliente}</p>}
        </div>
        {/* Programação, RDOs e Análise ficam no menu lateral; aqui só a ação do dia a dia. */}
        <Link href={`/obras/${obra.id}/turnos/novo`} className={`${classesBotao()} shrink-0`}>Novo turno</Link>
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
                  className="block rounded-cartao focus-visible:outline-2 focus-visible:outline-operacional"
                >
                  <Cartao className="flex items-center justify-between gap-3 transition-colors hover:bg-primaria-clara">
                    <div>
                      <p className="font-semibold text-texto">{formatarData(t.data)}</p>
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

      <Responsaveis obraId={obra.id} responsaveis={responsaveis} />
    </div>
  );
}
