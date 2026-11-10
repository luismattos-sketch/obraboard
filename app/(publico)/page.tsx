import Image from "next/image";
import Link from "next/link";
import { classesBotao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";

const blocos = [
  {
    titulo: "Planeje o turno",
    texto: "Monte o plano do dia com as frentes de serviço, equipes e metas, seguindo o Last Planner.",
  },
  {
    titulo: "Encarregado lança pelo celular",
    texto: "O encarregado registra o que foi feito e a causa do que não foi, sem instalar nada.",
  },
  {
    titulo: "RDO em PDF",
    texto: "O Relatório Diário de Obra sai pronto, com os dados lançados no canteiro.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <Image src="/frentia-logo.png" alt="Frentia" width={128} height={33} priority />
        <Link href="/login" className="text-sm font-semibold text-primaria underline">
          Entrar
        </Link>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 pb-12 pt-10 text-center sm:pt-16">
          <h1 className="text-4xl font-bold tracking-tight text-primaria sm:text-6xl">Frentia</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-texto-suave sm:text-xl">
            Planeje o turno, acompanhe a execução e gere o RDO direto do canteiro.
          </p>
          <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
            <Link href="/cadastro" className={`${classesBotao("primario")} bg-destaque hover:bg-destaque-escura`}>
              Criar conta grátis
            </Link>
            <Link href="/login" className={classesBotao("secundario")}>
              Entrar
            </Link>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-16 sm:grid-cols-3">
          {blocos.map((b, i) => (
            <Cartao key={b.titulo}>
              <span className="mb-3 inline-flex size-8 items-center justify-center rounded-full bg-primaria-clara text-sm font-bold text-primaria">
                {i + 1}
              </span>
              <h2 className="text-lg font-semibold text-primaria">{b.titulo}</h2>
              <p className="mt-2 text-sm text-texto-suave">{b.texto}</p>
            </Cartao>
          ))}
        </section>
      </main>

      <footer className="border-t border-borda py-6 text-center text-sm text-texto-suave">
        <Link href="/termos" className="underline">Termos de uso</Link>
        {" · "}
        <Link href="/privacidade" className="underline">Política de privacidade</Link>
      </footer>
    </div>
  );
}
