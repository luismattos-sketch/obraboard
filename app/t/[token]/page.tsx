import type { Metadata } from "next";
import { Aviso } from "@/components/ui/Aviso";
import Link from "next/link";
import { ERRO_FECHADO, ERRO_LINK, obterTurnoPorToken, opcoesFuncaoCampo, responsaveisDoTurno } from "@/lib/db/campo";
import { resolverEscolhaCampo } from "@/lib/dominio/quadro";
import { EscolhaResponsavel } from "./EscolhaResponsavel";
import { formatarData, ROTULO_PERIODO } from "@/lib/dominio/formato";
import { FormularioCampo } from "./FormularioCampo";

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
  const { r } = await searchParams;
  const turno = await obterTurnoPorToken(token);

  if (!turno) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-8">
        <h1 className="text-titulo font-semibold text-primaria">Frentia</h1>
        <Aviso tom="perigo">{ERRO_LINK}</Aviso>
      </main>
    );
  }

  const [opcoesFuncao, responsaveis] = await Promise.all([opcoesFuncaoCampo(turno), responsaveisDoTurno(turno)]);
  const escolha = resolverEscolhaCampo(r, responsaveis.map((x) => x.id));
  const atual = escolha.modo === "responsavel" ? responsaveis.find((x) => x.id === escolha.id) ?? null : null;
  const daEquipe = <T extends { responsavel_id: string | null }>(xs: T[]) =>
    atual ? xs.filter((x) => x.responsavel_id === atual.id) : xs;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-titulo font-semibold text-primaria">{turno.obra.nome}</h1>
        <p className="text-sm text-texto-suave">
          {formatarData(turno.data)} · {ROTULO_PERIODO[turno.periodo]}
        </p>
      </header>
      {turno.status === "fechado" && <Aviso tom="info">Turno fechado pelo planejador</Aviso>}
      {turno.status === "planejado" && <Aviso tom="alerta">{ERRO_FECHADO}</Aviso>}
      {escolha.modo === "escolher" ? (
        <EscolhaResponsavel responsaveis={responsaveis} />
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
            turno={{
              status: turno.status,
              hora_inicio_real: turno.hora_inicio_real,
              hora_fim_real: turno.hora_fim_real,
              atividades: daEquipe(turno.atividades),
              efetivo: daEquipe(turno.efetivo).map((e) => ({ funcao: e.funcao, quantidade: e.quantidade, responsavel_id: e.responsavel_id })),
              clima: turno.clima,
            }}
          />
        </>
      )}
    </main>
  );
}
