"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { sair } from "@/app/(publico)/auth-acoes";
import { COOKIE_MENU, iniciais, obraIdDoCaminho } from "@/lib/dominio/navegacao";

type Props = {
  obras: { id: string; nome: string }[];
  nome: string;
  recolhidoInicial: boolean;
  children: ReactNode;
};

const UM_ANO = 60 * 60 * 24 * 365;
const foco = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-operacional";
const botaoIcone = `inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-botao text-primaria hover:bg-primaria-clara ${foco}`;

function Icone({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const ICONE_MENU = "M4 6h16M4 12h16M4 18h16";
const ICONE_FECHAR = "M6 6l12 12M18 6L6 18";
const ICONE_MAIS = "M12 5v14M5 12h14";
const ICONE_SAIR = "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11";

/**
 * Casca do app com menu lateral (estilo Gemini).
 * Computador: menu fixo à esquerda, recolhível para uma faixa estreita (lembrado em cookie).
 * Celular: menu escondido, abre por cima da tela pelo botão ☰ da barra superior.
 */
export function MenuLateral({ obras, nome, recolhidoInicial, children }: Props) {
  const [recolhido, setRecolhido] = useState(recolhidoInicial);
  const [aberto, setAberto] = useState(false); // gaveta do celular
  const obraAtiva = obraIdDoCaminho(usePathname() ?? "");

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  function alternarRecolhido() {
    const novo = !recolhido;
    setRecolhido(novo);
    document.cookie = `${COOKIE_MENU}=${novo ? "recolhido" : "aberto"}; path=/; max-age=${UM_ANO}; samesite=lax`;
  }

  const fechar = () => setAberto(false);
  // Some só no computador quando recolhido; no celular a gaveta sempre mostra tudo.
  const rotulo = recolhido ? "md:sr-only" : "";

  return (
    <div className="min-h-screen md:flex">
      {/* Barra superior: só no celular */}
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-borda bg-superficie px-2 py-2 md:hidden">
        <button type="button" className={botaoIcone} aria-label="Abrir menu" aria-expanded={aberto}
          aria-controls="menu-lateral" onClick={() => setAberto(true)}>
          <Icone d={ICONE_MENU} />
        </button>
        <Link href="/obras" aria-label="Frentia, suas obras" className={`rounded-botao ${foco}`}>
          <Image src="/frentia-logo.png" alt="Frentia" width={112} height={28} priority />
        </Link>
      </header>

      {/* Fundo escurecido da gaveta do celular */}
      {aberto && (
        <div className="fixed inset-0 z-30 bg-primaria-escura/40 md:hidden" aria-hidden="true" onClick={fechar} />
      )}

      <aside
        id="menu-lateral"
        aria-label="Menu"
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-borda bg-superficie transition-[transform,width] duration-200
          ${aberto ? "translate-x-0" : "-translate-x-full max-md:invisible"}
          md:visible md:sticky md:top-0 md:h-screen md:translate-x-0 ${recolhido ? "md:w-16" : "md:w-64"}`}
      >
        <div className={`flex items-center gap-2 px-3 pt-3 pb-2 ${recolhido ? "md:justify-center md:px-0" : ""}`}>
          <button type="button" className={`${botaoIcone} max-md:hidden`}
            aria-label={recolhido ? "Expandir menu" : "Recolher menu"} aria-expanded={!recolhido}
            onClick={alternarRecolhido}>
            <Icone d={ICONE_MENU} />
          </button>
          <Link href="/obras" onClick={fechar} aria-label="Frentia, suas obras"
            className={`rounded-botao ${foco} ${recolhido ? "md:hidden" : ""}`}>
            <Image src="/frentia-logo.png" alt="Frentia" width={112} height={28} />
          </Link>
          <button type="button" className={`${botaoIcone} ml-auto md:hidden`} aria-label="Fechar menu" onClick={fechar}>
            <Icone d={ICONE_FECHAR} />
          </button>
        </div>

        <div className={`px-3 py-2 ${recolhido ? "md:flex md:justify-center md:px-0" : ""}`}>
          <Link href="/obras/nova" onClick={fechar} title={recolhido ? "Nova obra" : undefined}
            className={`flex min-h-11 items-center gap-2 rounded-botao bg-primaria-clara px-3 font-semibold text-primaria hover:bg-borda ${foco}
              ${recolhido ? "md:h-10 md:w-10 md:justify-center md:px-0" : ""}`}>
            <Icone d={ICONE_MAIS} />
            <span className={rotulo}>Nova obra</span>
          </Link>
        </div>

        <nav aria-label="Obras" className={`min-h-0 flex-1 overflow-y-auto px-3 py-2 ${recolhido ? "md:invisible" : ""}`}>
          <Link href="/obras" onClick={fechar}
            className={`block rounded-botao px-3 py-1 text-xs font-semibold tracking-wide text-texto-suave uppercase hover:text-operacional ${foco}`}>
            Obras
          </Link>
          {obras.length === 0 ? (
            <p className="px-3 py-2 text-sm text-texto-suave">Nenhuma obra ainda.</p>
          ) : (
            <ul className="mt-1 flex flex-col gap-0.5">
              {obras.map((o) => {
                const ativa = o.id === obraAtiva;
                return (
                  <li key={o.id}>
                    <Link href={`/obras/${o.id}`} onClick={fechar} aria-current={ativa ? "page" : undefined}
                      className={`block truncate rounded-botao px-3 py-2 text-sm ${foco}
                        ${ativa ? "bg-primaria-clara font-semibold text-primaria" : "text-texto hover:bg-fundo"}`}>
                      {o.nome}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        <div className={`flex items-center gap-2 border-t border-borda px-3 py-3 ${recolhido ? "md:flex-col md:px-0" : ""}`}>
          <span aria-hidden="true" title={nome}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primaria text-sm font-semibold text-white">
            {iniciais(nome)}
          </span>
          <span className={`min-w-0 flex-1 truncate text-sm text-texto ${recolhido ? "md:hidden" : ""}`}>{nome}</span>
          <form action={sair}>
            <button type="submit" className={`${botaoIcone} text-texto-suave`} title="Sair">
              <Icone d={ICONE_SAIR} />
              <span className="sr-only">Sair</span>
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-4xl px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
