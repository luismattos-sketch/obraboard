import type { Metadata } from "next";
import { Aviso } from "@/components/ui/Aviso";
import { ComoUsarCampo } from "@/components/ajuda/ComoUsarCampo";
import Link from "next/link";
import { ERRO_FECHADO, ERRO_LINK, obterTurnoPorToken, opcoesFuncaoCampo, opcoesPuxarCampo, responsaveisDoTurno } from "@/lib/db/campo";
import { resolverEscolhaCampo } from "@/lib/dominio/quadro";
import { ConfirmarResponsavel, EscolhaResponsavel } from "./EscolhaResponsavel";
import { formatarData, ROTULO_PERIODO } from "@/lib/dominio/formato";
import { FormularioCampo } from "./FormularioCampo";
import { intervaloDoTurno, janelaDoTurno } from "@/lib/dominio/efetivoHH";
import { urlsFotos } from "@/lib/db/fotosParada";
import { relatoPendente } from "@/lib/db/relatos";
import { iaLigada } from "@/lib/ia/cliente";

// Página de token: nunca cacheada, nunca indexada, sem vazar o link por Referer.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Frentia — Turno",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PaginaCampo({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const { token } = await params;
  const { r, confirmar } = await searchParams;
  const turno = await obterTurnoPorToken(token);

  if (!turno) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-8">
        <h1 className="text-titulo font-semibold text-primaria">Frentia</h1>
        <Aviso tom="perigo">{ERRO_LINK}</Aviso>
      </main>
    );
  }

  const [opcoesFuncao, responsaveis, fotos] = await Promise.all([
    opcoesFuncaoCampo(turno),
    responsaveisDoTurno(turno),
    urlsFotos(turno.ocorrencias.map((o) => o.foto_path ?? "")),
  ]);
  const escolha = resolverEscolhaCampo(r, responsaveis.map((x) => x.id));
  const atual = escolha.modo === "responsavel" ? responsaveis.find((x) => x.id === escolha.id) ?? null : null;
  const daEquipe = <T extends { responsavel_id: string | null }>(xs: T[]) =>
    atual ? xs.filter((x) => x.responsavel_id === atual.id) : xs;
  const abertoCampo = turno.status === "em_campo" || turno.status === "enviado";
  const opcoesPuxar = atual && abertoCampo ? await opcoesPuxarCampo(turno, atual.id) : undefined;
  // "Conte como foi o dia": só com responsável escolhido, IA ligada e atividade da equipe.
  const comContar = atual !== null && abertoCampo && iaLigada() && daEquipe(turno.atividades).length > 0;
  const pendente = comContar ? await relatoPendente(turno.id, atual.id) : null;
  const contarDia = comContar ? { texto: pendente?.texto ?? "", relatoId: pendente?.id ?? null } : null;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-titulo font-semibold text-primaria">{turno.obra.nome}</h1>
        <p className="text-sm text-texto-suave">
          {formatarData(turno.data)} · {ROTULO_PERIODO[turno.periodo]}
        </p>
      </header>
      <ComoUsarCampo />
      {turno.status === "fechado" && <Aviso tom="info">Turno fechado pelo planejador</Aviso>}
      {turno.status === "planejado" && <Aviso tom="alerta">{ERRO_FECHADO}</Aviso>}
      {escolha.modo === "escolher" ? (
        <EscolhaResponsavel responsaveis={responsaveis} />
      ) : atual && confirmar === "1" ? (
        <ConfirmarResponsavel responsavel={atual} />
      ) : (
        <>
          {responsaveis.length > 0 && (
            <p className="text-sm text-texto">
              {atual ? <>Lançando como <strong>{atual.nome}</strong></> : <>Vendo <strong>tudo</strong></>}
              {" · "}
              <Link href="?" className="text-operacional underline">Trocar</Link>
            </p>
          )}
          <FormularioCampo
            key={atual?.id ?? "todos"}
            token={token}
            opcoesFuncao={opcoesFuncao}
            responsaveis={responsaveis}
            responsavelId={atual?.id ?? null}
            opcoesPuxar={opcoesPuxar}
            contarDia={contarDia}
            turno={{
              status: turno.status,
              data: turno.data,
              periodo: turno.periodo,
              obraNome: turno.obra.nome,
              whatsapp: turno.obra.whatsapp_planejador ?? null,
              terminados: turno.terminados ?? [],
              fotos,
              hora_inicio_real: turno.hora_inicio_real,
              hora_fim_real: turno.hora_fim_real,
              atividades: daEquipe(turno.atividades),
              efetivo: daEquipe(turno.efetivo).map((e) => ({ funcao: e.funcao, quantidade: e.quantidade, responsavel_id: e.responsavel_id })),
              efetivoTodo: turno.efetivo.map((e) => ({ funcao: e.funcao, quantidade: e.quantidade, responsavel_id: e.responsavel_id })),
              ocorrencias: turno.ocorrencias,
              janela: janelaDoTurno(turno),
              intervalo: intervaloDoTurno(turno),
              clima: turno.clima,
            }}
          />
        </>
      )}
    </main>
  );
}
