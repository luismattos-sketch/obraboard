import type { Metadata } from "next";
import { AtualizarPeriodicamente } from "@/components/quadro/AtualizarPeriodicamente";
import { prepararQuadro } from "@/components/quadro/prepararQuadro";
import { Quadro } from "@/components/quadro/Quadro";
import { clienteDoQuadroPublico, obraPorCodigo } from "@/lib/db/quadro";

// Quadro público (TV / gestor): só leitura, nunca cacheado nem indexado, sem vazar o link por Referer.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Frentia — Quadro",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const LINK_DESATIVADO = "Link desativado. Peça o link novo ao planejador.";

export default async function QuadroPublico({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const [{ codigo }, busca] = await Promise.all([params, searchParams]);
  const obra = await obraPorCodigo(codigo);

  if (!obra) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-8">
        <h1 className="text-titulo font-semibold text-primaria">Frentia</h1>
        <p className="rounded-cartao bg-perigo-clara px-3 py-2 text-perigo">{LINK_DESATIVADO}</p>
      </main>
    );
  }

  // O cliente admin só lê o que pertence à obra resolvida pelo código (prepararQuadro filtra por obraId).
  const q = await prepararQuadro(clienteDoQuadroPublico(), obra.id, busca, `/q/${codigo}`);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[1600px] flex-col gap-3 px-4 py-4">
      {q ? (
        <>
          <Quadro {...q.props} publico editarHref={null} />
          <AtualizarPeriodicamente />
        </>
      ) : (
        <p className="rounded-cartao bg-superficie p-4 text-texto-suave">Nenhum turno ainda</p>
      )}
    </main>
  );
}
