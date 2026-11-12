"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { sair } from "@/app/(publico)/auth-acoes";
import {
  caminhoAoTrocarObra, caminhoEtapa, COOKIE_MENU, ETAPAS, etapaDoCaminho, iniciais, obraIdDoCaminho, type Etapa,
} from "@/lib/dominio/navegacao";

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
    <svg viewBox="0 0 24 24" width="22" height="22" className="shrink-0" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const ICONE_MENU = "M4 6h16M4 12h16M4 18h16";
const ICONE_FECHAR = "M6 6l12 12M18 6L6 18";
const ICONE_MAIS = "M12 5v14M5 12h14";
const ICONE_RDO = "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6";
const ICONE_OBRA = "M3 21h18M5 21V8l7-4 7 4v13M9 21v-6h6v6";
const ICONE_SETA = "M6 9l6 6 6-6";
const ICONE_LISTA = "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01";
const ICONE_ETAPA: Record<Etapa, string> = {
  programacao: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 15l2 2 4-4",
  turnos: "M2 18h20M4 18v-3a8 8 0 0 1 16 0v3M10 7V5h4v2",
  rdos: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6",
  analise: "M3 3v18h18M7 15l4-4 3 3 5-6",
};
const ICONE_SAIR = "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11";

/**
 * Casca do app com menu lateral (estilo Gemini).
 * Computador: menu fixo à esquerda, recolhível para uma faixa estreita (lembrado em cookie).
 * Celular: menu escondido, abre por cima da tela pelo botão ☰ da barra superior.
 */
export function MenuLateral({ obras, nome, recolhidoInicial, children }: Props) {
  const [recolhido, setRecolhido] = useState(recolhidoInicial);
  const [aberto, setAberto] = useState(false); // gaveta do celular
  const caminho = usePathname() ?? "";
  const obraAtiva = obraIdDoCaminho(caminho);
  const etapaAtiva = etapaDoCaminho(caminho);
  const naRdos = caminho === "/rdos";

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

        <SeletorObra obras={obras} obraAtiva={obraAtiva} caminho={caminho} recolhido={recolhido} aoNavegar={fechar} />

        <nav aria-label="Etapas da obra" className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {obraAtiva ? (
            <ol className={`flex flex-col gap-0.5 ${recolhido ? "md:items-center" : ""}`}>
              {ETAPAS.map((e, i) => {
                const ativa = e.id === etapaAtiva;
                return (
                  <li key={e.id}>
                    <Link href={caminhoEtapa(obraAtiva, e.id)} onClick={fechar}
                      title={recolhido ? e.rotulo : undefined} aria-current={ativa ? "page" : undefined}
                      className={`flex min-h-11 items-center gap-3 rounded-botao px-3 text-sm ${foco}
                        ${ativa ? "bg-primaria-clara font-semibold text-primaria" : "text-texto hover:bg-fundo"}
                        ${recolhido ? "md:h-10 md:w-10 md:justify-center md:px-0" : ""}`}>
                      <Icone d={ICONE_ETAPA[e.id]} />
                      <span className={rotulo}>
                        <span aria-hidden="true" className="mr-1 text-texto-suave">{i + 1}.</span>
                        {e.rotulo}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className={`px-3 py-2 text-sm text-texto-suave ${recolhido ? "md:hidden" : ""}`}>
              {obras.length === 0 ? "Cadastre uma obra para começar." : "Escolha uma obra acima para ver as etapas."}
            </p>
          )}
        </nav>

        <div className={`border-t border-borda px-3 py-2 ${recolhido ? "md:flex md:justify-center md:px-0" : ""}`}>
          <Link href="/rdos" onClick={fechar} title={recolhido ? "RDOs de todas as obras" : undefined} aria-current={naRdos ? "page" : undefined}
            className={`flex min-h-11 items-center gap-2 rounded-botao px-3 text-sm ${foco}
              ${naRdos ? "bg-primaria-clara font-semibold text-primaria" : "text-texto hover:bg-fundo"}
              ${recolhido ? "md:h-10 md:w-10 md:justify-center md:px-0" : ""}`}>
            <Icone d={ICONE_RDO} />
            <span className={rotulo}>RDOs de todas as obras</span>
          </Link>
        </div>

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
        {/* Alinhado à esquerda, junto do menu; o topo acompanha a altura da logo do menu. */}
        <div className="w-full max-w-5xl px-4 pt-4 pb-8 md:px-8">{children}</div>
      </main>
    </div>
  );
}

/** Obra em uso, escolhida num menu suspenso. A obra fica no endereço (/obras/{id}), nunca no navegador. */
function SeletorObra({ obras, obraAtiva, caminho, recolhido, aoNavegar }: {
  obras: Props["obras"]; obraAtiva: string | null; caminho: string; recolhido: boolean; aoNavegar: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const atual = obras.find((o) => o.id === obraAtiva);
  const rotulo = atual?.nome ?? "Escolher obra";

  useEffect(() => {
    if (!aberto) return;
    const aoClicar = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    // Esc fecha só a lista (não a gaveta do celular).
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setAberto(false); } };
    document.addEventListener("mousedown", aoClicar);
    window.addEventListener("keydown", aoTeclar, true);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      window.removeEventListener("keydown", aoTeclar, true);
    };
  }, [aberto]);

  const escolher = () => { setAberto(false); aoNavegar(); };
  const item = `flex min-h-11 items-center gap-2 rounded-botao px-3 text-sm ${foco}`;

  return (
    <div ref={caixa} className={`relative px-3 py-2 ${recolhido ? "md:flex md:justify-center md:px-0" : ""}`}>
      <span className={`block px-1 pb-1 text-xs font-semibold tracking-wide text-texto-suave uppercase ${recolhido ? "md:hidden" : ""}`}>
        Obra
      </span>
      <button type="button" aria-haspopup="true" aria-expanded={aberto} aria-controls="lista-obras"
        title={recolhido ? rotulo : undefined} onClick={() => setAberto((v) => !v)}
        className={`flex min-h-11 w-full items-center gap-2 rounded-botao border border-borda bg-superficie px-3 text-left text-sm font-semibold text-primaria hover:bg-primaria-clara ${foco}
          ${recolhido ? "md:h-10 md:w-10 md:justify-center md:px-0" : ""}`}>
        <Icone d={ICONE_OBRA} />
        <span className={`min-w-0 flex-1 truncate ${recolhido ? "md:sr-only" : ""}`}>
          <span className="sr-only">Obra: </span>{rotulo}
        </span>
        <span className={recolhido ? "md:hidden" : ""}><Icone d={ICONE_SETA} /></span>
      </button>

      {aberto && (
        <div id="lista-obras"
          className={`absolute top-full right-3 left-3 z-50 mt-1 max-h-[60vh] overflow-y-auto rounded-cartao border border-borda bg-superficie p-1 shadow-lg
            ${recolhido ? "md:top-2 md:right-auto md:left-full md:ml-2 md:w-64" : ""}`}>
          {obras.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {obras.map((o) => {
                const ativa = o.id === obraAtiva;
                return (
                  <li key={o.id}>
                    <Link href={caminhoAoTrocarObra(caminho, o.id)} onClick={escolher} aria-current={ativa ? "true" : undefined}
                      className={`${item} ${ativa ? "bg-primaria-clara font-semibold text-primaria" : "text-texto hover:bg-fundo"}`}>
                      <span className="min-w-0 flex-1 truncate">{o.nome}</span>
                      {ativa && <span aria-hidden="true">✓</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <div className={`flex flex-col gap-0.5 ${obras.length > 0 ? "mt-1 border-t border-borda pt-1" : ""}`}>
            <Link href="/obras" onClick={escolher} className={`${item} text-texto hover:bg-fundo`}>
              <Icone d={ICONE_LISTA} />Ver todas as obras
            </Link>
            <Link href="/obras/nova" onClick={escolher} className={`${item} font-semibold text-primaria hover:bg-primaria-clara`}>
              <Icone d={ICONE_MAIS} />Nova obra
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
