import { BotaoAjuda } from "@/components/ajuda/BotaoAjuda";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Cartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import { obterObra } from "@/lib/db/obras";
import { dadosOficiais, obterSemana, resumoSemanaAnterior, sugestoesFuncaoDaObra } from "@/lib/db/programacao";
import { listarResponsaveis } from "@/lib/db/responsaveis";
import { inicioDaSemana } from "@/lib/dominio/analise";
import { hojeSaoPaulo } from "@/lib/dominio/entrada";
import { formatarData } from "@/lib/dominio/formato";
import { dataDoDia, resumirSemana, ROTULO_STATUS_SEMANA, statusExibido, TOM_STATUS_SEMANA } from "@/lib/dominio/programacao";
import { FUNCOES_SUGERIDAS } from "@/lib/dominio/tipos";
import { pendentesDaSemanaAnterior, saldoDaOrigem } from "@/lib/dominio/trazerSaldo";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { AbrirSemana } from "../AbrirSemana";
import { Acompanhamento } from "./Acompanhamento";
import { ListaRascunho } from "./ListaRascunho";
import { listarItensCronograma } from "@/lib/db/cronograma";
import { diasDoItemNaSemana } from "@/lib/dominio/cronograma";
import { listarRestricoesDaObra } from "@/lib/db/restricoes";
import { restricoesAbertasDoItem } from "@/lib/dominio/travaRestricao";

const diaMes = (iso: string) => formatarData(iso).slice(0, 5);

/** YYYY-MM-DD que existe no calendário. */
function dataValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

export default async function SemanaPage({
  params,
  searchParams,
}: {
  params: Promise<{ obraId: string; inicio: string }>;
  searchParams: Promise<{ item?: string }>;
}) {
  const { obraId, inicio } = await params;
  const { item: itemId } = await searchParams;
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
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-titulo font-semibold text-primaria">{titulo}</h1>
          <BotaoAjuda tela={semana && ["encerrada", "aguardando_encerramento"].includes(statusExibido(semana.status, semana.inicio, hoje)) ? "encerrar-semana" : "programacao"} />
        </div>
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

  const rascunho = semana.status === "rascunho";
  const [dados, sugestoesFuncao, responsaveis, anterior, itensCronograma, restricoes] = await Promise.all([
    dadosOficiais(supabase, semana),
    semana.status === "rascunho"
      ? sugestoesFuncaoDaObra(supabase, obra.id).catch(() => [...FUNCOES_SUGERIDAS])
      : Promise.resolve([]),
    listarResponsaveis(supabase, obra.id),
    semana.status === "encerrada" ? Promise.resolve(null) : resumoSemanaAnterior(supabase, semana),
    rascunho ? listarItensCronograma(supabase, obra.id, { incluirRemovidos: true }) : Promise.resolve([]),
    rascunho && itemId ? listarRestricoesDaObra(supabase, obra.id) : Promise.resolve(new Map()),
  ]);
  // Item 5.1: "Levar para esta semana" do lookahead chega com ?item= (só no rascunho).
  const codigosCronograma = Object.fromEntries(itensCronograma.map((i) => [i.id, i.codigo]));
  const itemLevado = rascunho && itemId ? itensCronograma.find((i) => i.id === itemId) : undefined;
  const doCronograma = itemLevado
    ? {
        item: { id: itemLevado.id, codigo: itemLevado.codigo, restricoesAbertas: restricoesAbertasDoItem(itemLevado.id, restricoes) },
        modelo: {
          id: "", ordem: 0, descricao: itemLevado.descricao.slice(0, 200), local: itemLevado.local?.slice(0, 100) ?? null,
          unidade: itemLevado.unidade?.slice(0, 20) ?? null, meta: itemLevado.quantidade ?? 0,
          dias: diasDoItemNaSemana(itemLevado, semana.inicio), periodo: "diurno" as const, causa: null,
          responsavel_id: null, equipe: [],
        },
      }
    : undefined;
  // Item 1.6: o que ficou da semana anterior e o saldo atual da origem de cada atividade já trazida.
  const pendentes = anterior && semana.status === "rascunho" ? pendentesDaSemanaAnterior(anterior) : [];
  const saldosAtuais: Record<string, number> = {};
  if (anterior) {
    for (const a of dados.atividades) {
      const s = a.trazida_de ? saldoDaOrigem(anterior, a.trazida_de) : null;
      if (s !== null) saldosAtuais[a.id] = s;
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {cabecalho}
      {semana.status === "rascunho" ? (
        <ListaRascunho
          semanaId={semana.id}
          obraId={obra.id}
          responsaveis={responsaveis}
          atividades={dados.atividades}
          sugestoesFuncao={sugestoesFuncao}
          pendentes={pendentes}
          saldosAtuais={saldosAtuais}
          doCronograma={doCronograma}
          codigosCronograma={codigosCronograma}
        />
      ) : (
        <Acompanhamento semana={semana} resumo={resumirSemana(dados)} hoje={hoje} responsaveis={responsaveis} saldosAtuais={saldosAtuais} />
      )}
    </div>
  );
}
