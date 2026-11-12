import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Cartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import { obterObra } from "@/lib/db/obras";
import { dadosOficiais, obterSemana, sugestoesFuncaoDaObra } from "@/lib/db/programacao";
import { inicioDaSemana } from "@/lib/dominio/analise";
import { hojeSaoPaulo } from "@/lib/dominio/entrada";
import { formatarData } from "@/lib/dominio/formato";
import { dataDoDia, resumirSemana, ROTULO_STATUS_SEMANA, statusExibido, TOM_STATUS_SEMANA } from "@/lib/dominio/programacao";
import { FUNCOES_SUGERIDAS } from "@/lib/dominio/tipos";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { AbrirSemana } from "../AbrirSemana";
import { Acompanhamento } from "./Acompanhamento";
import { ListaRascunho } from "./ListaRascunho";

const diaMes = (iso: string) => formatarData(iso).slice(0, 5);

/** YYYY-MM-DD que existe no calendário. */
function dataValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

export default async function SemanaPage({ params }: { params: Promise<{ obraId: string; inicio: string }> }) {
  const { obraId, inicio } = await params;
  if (!dataValida(inicio)) notFound();
  const segunda = inicioDaSemana(inicio);
  if (segunda !== inicio) redirect(`/obras/${obraId}/programacao/${segunda}`);

  const supabase = await criarClienteServidor();
  const obra = await obterObra(supabase, obraId);
  if (!obra) notFound();
  const semana = await obterSemana(supabase, obraId, inicio);
  const hoje = hojeSaoPaulo();
  const titulo = `Semana de ${diaMes(inicio)} a ${diaMes(dataDoDia(inicio, 6))}`;

  const cabecalho = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <Link href={`/obras/${obra.id}/programacao`} className="text-sm text-texto-suave hover:underline">
          ← Programação · {obra.nome}
        </Link>
        <h1 className="text-titulo font-semibold text-primaria">{titulo}</h1>
      </div>
      {semana && (
        <Selo tom={TOM_STATUS_SEMANA[statusExibido(semana.status, semana.inicio, hoje)]}>
          {ROTULO_STATUS_SEMANA[statusExibido(semana.status, semana.inicio, hoje)]}
        </Selo>
      )}
    </div>
  );

  if (!semana) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        {cabecalho}
        <Cartao className="flex flex-col gap-3">
          <p className="text-texto-suave">Esta semana ainda não tem programação.</p>
          <AbrirSemana obraId={obra.id} data={inicio} rotulo="Criar rascunho desta semana" />
        </Cartao>
      </div>
    );
  }

  const [dados, sugestoesFuncao] = await Promise.all([
    dadosOficiais(supabase, semana),
    semana.status === "rascunho"
      ? sugestoesFuncaoDaObra(supabase, obra.id).catch(() => [...FUNCOES_SUGERIDAS])
      : Promise.resolve([]),
  ]);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {cabecalho}
      {semana.status === "rascunho" ? (
        <ListaRascunho semanaId={semana.id} atividades={dados.atividades} sugestoesFuncao={sugestoesFuncao} />
      ) : (
        <Acompanhamento semana={semana} resumo={resumirSemana(dados)} hoje={hoje} />
      )}
    </div>
  );
}
