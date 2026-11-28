import type { Metadata } from "next";
import { extrasDoLink, linkPorCodigo, ERRO_LINK_CIENCIA } from "@/lib/db/ciencia";
import { urlsFotos } from "@/lib/db/fotosParada";
import { somarDias } from "@/lib/dominio/programacao";
import { formatarData } from "@/lib/dominio/formato";
import { ListaCiencia } from "./ListaCiencia";

// Ciência do cliente (item 4.3): sem login, nunca cacheada nem indexada, sem vazar o link por Referer.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Frentia — Serviços extras",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function CienciaPublica({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const link = await linkPorCodigo(codigo);
  if (!link) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-8">
        <h1 className="text-titulo font-semibold text-primaria">Frentia</h1>
        <p className="rounded-cartao bg-perigo-clara px-3 py-2 text-perigo">{ERRO_LINK_CIENCIA}</p>
      </main>
    );
  }
  const extras = await extrasDoLink(link);
  const fotos = await urlsFotos(extras.map((e) => e.foto_path ?? "").filter(Boolean));

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-texto-suave">Frentia · ciência do cliente</p>
        <h1 className="text-titulo font-semibold text-primaria">Serviços extras da semana</h1>
        <p className="text-texto">
          {link.obraNome}
          {link.cliente ? ` · ${link.cliente}` : ""}
        </p>
        <p className="text-sm text-texto-suave">
          De {formatarData(link.semana)} a {formatarData(somarDias(link.semana, 6))}
        </p>
      </header>
      <p className="text-sm text-texto-suave">
        Serviços feitos fora da programação. Confira e registre que está ciente: fica gravado o seu nome com a data e a hora. Ciência não é
        aprovação de preço.
      </p>
      <ListaCiencia codigo={codigo} extras={extras} fotos={fotos} />
    </main>
  );
}
