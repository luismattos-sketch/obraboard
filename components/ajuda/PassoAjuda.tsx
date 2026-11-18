import Image from "next/image";
import { caminhoCaptura } from "@/lib/ajuda/capitulos";
import type { Passo, SlugCapitulo } from "@/lib/ajuda/tipos";

/** Tamanho das capturas geradas pelo roteiro (tests/manual): computador 1280×800, celular = Pixel 7. */
const TAMANHO = { computador: { width: 1280, height: 800 }, celular: { width: 412, height: 839 } } as const;

export function PassoAjuda({ slug, passo, numero }: { slug: SlugCapitulo; passo: Passo; numero: number }) {
  const { captura } = passo;
  return (
    <section id={passo.id} className="flex scroll-mt-20 flex-col gap-3">
      <h2 className="flex items-baseline gap-2 text-lg font-semibold text-primaria">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primaria text-sm text-white">
          {numero}
        </span>
        {passo.titulo}
      </h2>
      {passo.texto.map((t) => <p key={t} className="text-texto">{t}</p>)}
      {passo.dica && (
        <p className="rounded-botao border border-borda bg-primaria-clara p-3 text-sm text-texto">
          <strong>Dica:</strong> {passo.dica}
        </p>
      )}
      {captura && (
        <Image
          src={caminhoCaptura(slug, passo.id)}
          alt={captura.alt}
          {...TAMANHO[captura.dispositivo]}
          sizes={captura.dispositivo === "celular" ? "(max-width: 640px) 80vw, 320px" : "(max-width: 900px) 100vw, 860px"}
          className={`h-auto rounded-cartao border border-borda shadow-sm ${captura.dispositivo === "celular" ? "w-full max-w-80" : "w-full"}`}
        />
      )}
    </section>
  );
}
