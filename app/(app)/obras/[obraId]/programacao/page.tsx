import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/ui/Aviso";
import { Cartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import { obterObra } from "@/lib/db/obras";
import { listarSemanasComResumo } from "@/lib/db/programacao";
import { hojeSaoPaulo } from "@/lib/dominio/entrada";
import { formatarData, formatarPercentual } from "@/lib/dominio/formato";
import { dataDoDia, ROTULO_STATUS_SEMANA, somarDias, statusExibido, TOM_STATUS_SEMANA } from "@/lib/dominio/programacao";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { AbrirSemana } from "./AbrirSemana";

/** "2026-11-09" -> "09/11" */
const diaMes = (iso: string) => formatarData(iso).slice(0, 5);

export default async function ProgramacaoPage({ params }: { params: Promise<{ obraId: string }> }) {
  const { obraId } = await params;
  const supabase = await criarClienteServidor();
  const obra = await obterObra(supabase, obraId);
  if (!obra) notFound();

  const hoje = hojeSaoPaulo();
  let semanas: Awaited<ReturnType<typeof listarSemanasComResumo>> | null = null;
  try {
    semanas = await listarSemanasComResumo(supabase, obraId);
  } catch {
    semanas = null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/obras/${obra.id}`} className="text-sm text-texto-suave hover:underline">
            ← {obra.nome}
          </Link>
          <h1 className="text-titulo font-semibold text-primaria">Programação</h1>
        </div>
        <AbrirSemana obraId={obra.id} data={somarDias(hoje, 7)} rotulo="Programar próxima semana" />
      </div>

      <Cartao>
        <AbrirSemana obraId={obra.id} data={hoje} rotulo="Abrir semana" comSeletor variante="secundario" />
      </Cartao>

      {semanas === null ? (
        <Aviso tom="perigo">Não foi possível carregar as semanas. Tente de novo.</Aviso>
      ) : semanas.length === 0 ? (
        <Cartao>
          <p className="text-texto-suave">
            Nenhuma semana programada ainda. Programe a próxima semana para firmar o compromisso da equipe.
          </p>
        </Cartao>
      ) : (
        <ul className="flex flex-col gap-3">
          {semanas.map(({ semana, ppc }) => {
            const st = statusExibido(semana.status, semana.inicio, hoje);
            return (
              <li key={semana.id}>
                <Link
                  href={`/obras/${obra.id}/programacao/${semana.inicio}`}
                  className="block rounded-cartao focus-visible:outline-2 focus-visible:outline-operacional"
                >
                  <Cartao className="flex flex-wrap items-center justify-between gap-3 transition-colors hover:bg-primaria-clara">
                    <div>
                      <p className="font-semibold text-texto">
                        Semana de {diaMes(semana.inicio)} a {diaMes(dataDoDia(semana.inicio, 6))}
                      </p>
                      <p className="text-sm text-texto-suave">
                        {ppc && ppc.total > 0
                          ? `PPC ${formatarPercentual(ppc.ppc)} — ${ppc.cumpridas} de ${ppc.total}${semana.status === "encerrada" ? "" : " (provisório)"}`
                          : "PPC —"}
                      </p>
                    </div>
                    <Selo tom={TOM_STATUS_SEMANA[st]}>{ROTULO_STATUS_SEMANA[st]}</Selo>
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
