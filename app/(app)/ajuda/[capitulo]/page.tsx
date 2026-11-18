import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PassoAjuda } from "@/components/ajuda/PassoAjuda";
import { capituloPorSlug, proximoCapitulo } from "@/lib/ajuda/capitulos";

type Props = { params: Promise<{ capitulo: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cap = capituloPorSlug((await params).capitulo);
  return { title: cap ? `${cap.titulo} | Ajuda | Frentia` : "Ajuda | Frentia" };
}

export default async function PaginaCapitulo({ params }: Props) {
  const cap = capituloPorSlug((await params).capitulo);
  if (!cap) notFound();
  const proximo = proximoCapitulo(cap.slug);
  return (
    <article className="flex min-w-0 max-w-3xl flex-col gap-8">
      <div>
        <Link href="/ajuda" className="text-sm text-texto-suave hover:underline">← Ajuda</Link>
        <h1 className="text-titulo font-semibold text-primaria">{cap.titulo}</h1>
        <p className="text-texto-suave">{cap.resumo}</p>
      </div>
      {cap.passos.map((p, i) => <PassoAjuda key={p.id} slug={cap.slug} passo={p} numero={i + 1} />)}
      <nav aria-label="Capítulos" className="flex flex-wrap justify-between gap-3 border-t border-borda pt-4">
        <Link href="/ajuda" className="text-operacional underline">Voltar à Ajuda</Link>
        {proximo && (
          <Link href={`/ajuda/${proximo.slug}`} className="font-semibold text-operacional underline">
            Próximo: {proximo.titulo} →
          </Link>
        )}
      </nav>
    </article>
  );
}
