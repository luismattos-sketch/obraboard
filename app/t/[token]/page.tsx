import type { Metadata } from "next";
import { Aviso } from "@/components/ui/Aviso";
import { ERRO_FECHADO, ERRO_LINK, obterTurnoPorToken } from "@/lib/db/campo";
import { formatarData, ROTULO_PERIODO } from "@/lib/dominio/formato";
import { FormularioCampo } from "./FormularioCampo";

// Página de token: nunca cacheada, nunca indexada, sem vazar o link por Referer.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Frentia — Turno",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PaginaCampo({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const turno = await obterTurnoPorToken(token);

  if (!turno) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-8">
        <h1 className="text-titulo font-semibold text-primaria">Frentia</h1>
        <Aviso tom="perigo">{ERRO_LINK}</Aviso>
      </main>
    );
  }

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
      <FormularioCampo
        token={token}
        turno={{
          status: turno.status,
          hora_inicio_real: turno.hora_inicio_real,
          hora_fim_real: turno.hora_fim_real,
          atividades: turno.atividades,
          efetivo: turno.efetivo.map((e) => ({ funcao: e.funcao, quantidade: e.quantidade })),
          clima: turno.clima,
        }}
      />
    </main>
  );
}
