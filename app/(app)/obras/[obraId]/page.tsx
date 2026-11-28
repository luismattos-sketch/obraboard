import { BotaoAjuda } from "@/components/ajuda/BotaoAjuda";
import Link from "next/link";
import { notFound } from "next/navigation";
import { classesBotao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import { obterIntervalosObra, obterObra } from "@/lib/db/obras";
import { listarResponsaveis } from "@/lib/db/responsaveis";
import { linkQuadro } from "@/lib/db/quadro";
import { listarTurnosComAtividades } from "@/lib/db/turnos";
import { percentualCumprimento } from "@/lib/dominio/calculos";
import { formatarData, ROTULO_PERIODO, TOM_STATUS_TURNO } from "@/lib/dominio/formato";
import { ROTULO_STATUS_TURNO } from "@/lib/dominio/tipos";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { LinkQuadro } from "./LinkQuadro";
import { Responsaveis } from "./Responsaveis";
import { IntervaloObra } from "./IntervaloObra";
import { WhatsappObra } from "./WhatsappObra";
import { CidadeObra } from "./CidadeObra";
import { CienciaExtras } from "./CienciaExtras";
import { semanasDeCiencia } from "@/lib/db/ciencia";
import { hojeSaoPaulo } from "@/lib/dominio/entrada";
import { RoteiroSemana } from "@/components/obra/RoteiroSemana";
import { obterSemana, resumoSemanaAnterior } from "@/lib/db/programacao";
import { listarRestricoesDaObra } from "@/lib/db/restricoes";
import { inicioDaSemana } from "@/lib/dominio/analise";
import { somarDias } from "@/lib/dominio/programacao";
import { resumoRestricoes } from "@/lib/dominio/restricoes";
import { passosDoRoteiro, restricoesDeItensAtivos } from "@/lib/dominio/roteiro";
import { listarItensCronograma } from "@/lib/db/cronograma";

export default async function ObraPage({ params }: { params: Promise<{ obraId: string }> }) {
  const { obraId } = await params;
  const supabase = await criarClienteServidor();
  const obra = await obterObra(supabase, obraId);
  if (!obra) notFound();
  const [turnos, responsaveis, quadro, intervalos, ciencia] = await Promise.all([
    listarTurnosComAtividades(supabase, obraId),
    listarResponsaveis(supabase, obraId),
    linkQuadro(supabase, obraId),
    obterIntervalosObra(supabase, obraId),
    // Se a ciência falhar, a página da obra abre do mesmo jeito (sem o cartão).
    semanasDeCiencia(supabase, obraId, hojeSaoPaulo()).catch(() => null),
  ]);

  // Item 5.4: roteiro da semana (o que falta no ciclo do LPS).
  const hoje = hojeSaoPaulo();
  const atual = inicioDaSemana(hoje);
  const proximaInicio = somarDias(atual, 7);
  // Falhas aqui não derrubam a página da obra: o passo correspondente só fica sem o dado.
  const [anterior, resumoAnterior, proxima, restricoes, itensAtivos] = await Promise.all([
    obterSemana(supabase, obraId, somarDias(atual, -7)).catch(() => null),
    resumoSemanaAnterior(supabase, { obra_id: obraId, inicio: atual }).catch(() => null),
    obterSemana(supabase, obraId, proximaInicio).catch(() => null),
    listarRestricoesDaObra(supabase, obraId).catch(() => new Map()),
    listarItensCronograma(supabase, obraId).catch(() => []),
  ]);
  const passos = passosDoRoteiro({
    obraId, hoje, proximaInicio,
    anterior: anterior ? { inicio: anterior.inicio, status: anterior.status, ppc: resumoAnterior?.ppc.ppc ?? null } : null,
    proxima: proxima ? { inicio: proxima.inicio, status: proxima.status } : null,
    restricoes: resumoRestricoes(restricoesDeItensAtivos(restricoes, new Set(itensAtivos.map((i) => i.id))), hoje),
    turnosHoje: turnos.filter((t) => t.data === hoje).map((t) => ({ id: t.id, status: t.status, periodo: t.periodo })),
  });
  const tituloSemana = `${formatarData(atual).slice(0, 5)} a ${formatarData(somarDias(atual, 6)).slice(0, 5)}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-titulo font-semibold text-primaria">{obra.nome}</h1>
            <BotaoAjuda tela="obras" />
          </div>
          {obra.cliente && <p className="text-sm text-texto-suave">{obra.cliente}</p>}
        </div>
        {/* Programação, RDOs e Análise ficam no menu lateral; aqui só a ação do dia a dia. */}
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {quadro.codigo ? (
            <a href={`/q/${quadro.codigo}`} target="_blank" rel="noopener" className={classesBotao("secundario")}>Quadro</a>
          ) : (
            <a href="#link-quadro" className={classesBotao("secundario")}>Quadro</a>
          )}
          {turnos.length === 0 ? (
            <Link href={`/obras/${obra.id}/programacao`} className={classesBotao()}>Programar semana</Link>
          ) : (
            <Link href={`/obras/${obra.id}/turnos/novo`} className={classesBotao()}>Novo turno</Link>
          )}
        </div>
      </div>

      <RoteiroSemana obraId={obra.id} titulo={tituloSemana} passos={passos} />

      {turnos.length === 0 ? (
        <Cartao>
          <p className="text-texto-suave">
            Nenhum turno ainda. Comece pela <Link href={`/obras/${obra.id}/programacao`} className="text-operacional underline">Programação</Link>:
            com a semana programada, cada turno novo já vem com as atividades do dia. Se preferir, crie um{" "}
            <Link href={`/obras/${obra.id}/turnos/novo`} className="text-operacional underline">Novo turno</Link> direto.
          </p>
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
      <LinkQuadro obraId={obra.id} existe={quadro.existe} codigoAtual={quadro.codigo} />
      {ciencia && <CienciaExtras obraId={obra.id} obraNome={obra.nome} semanas={ciencia} />}
      {intervalos && <IntervaloObra obraId={obra.id} intervalos={intervalos} />}
      <CidadeObra
        obraId={obra.id}
        inicial={obra.local_nome && obra.latitude != null && obra.longitude != null ? { nome: obra.local_nome, latitude: obra.latitude, longitude: obra.longitude } : null}
      />
      <WhatsappObra obraId={obra.id} inicial={obra.whatsapp_planejador ?? null} />
    </div>
  );
}
