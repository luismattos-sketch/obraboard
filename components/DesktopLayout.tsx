"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  cadastroBaseEvento,
  carregarCadastroBase,
  obterObraAtiva,
  obterObraAtivaId,
  salvarObraAtivaId,
  type ObraCadastrada,
} from "../lib/cadastro-base";

interface Props {
  children: ReactNode;
  titulo: string;
  subtitulo?: string;
  status?: string;
  logoUrl?: string;
}

const menuItems = [
  { href: "/obra", label: "Obra", icon: "OB" },
  { href: "/checkin", label: "Check-in", icon: "✓" },
  { href: "/", label: "Painel", icon: "▦" },
  { href: "/checkout", label: "Check-out", icon: "↗" },
  { href: "/rdo", label: "RDO", icon: "▤" },
];

export default function DesktopLayout({
  children,
  titulo,
  subtitulo,
  status = "Turno em andamento",
  logoUrl,
}: Props) {
  const [logoSalvo, setLogoSalvo] = useState("");
  const [obras, setObras] = useState<ObraCadastrada[]>([]);
  const [obraAtivaId, setObraAtivaId] = useState<number | null>(null);
  const logoExibido = logoUrl ?? logoSalvo;

  useEffect(() => {
    function carregarContexto() {
      const cadastro = carregarCadastroBase();
      const obraAtiva = obterObraAtiva(cadastro);
      const ativoId = obterObraAtivaId(cadastro);

      if (logoUrl === undefined) {
        setLogoSalvo(obraAtiva?.logoUrl || cadastro.logoUrl);
      }

      setObras(cadastro.obras);
      setObraAtivaId(ativoId);
    }

    queueMicrotask(carregarContexto);
    window.addEventListener(cadastroBaseEvento, carregarContexto);
    window.addEventListener("storage", carregarContexto);

    return () => {
      window.removeEventListener(cadastroBaseEvento, carregarContexto);
      window.removeEventListener("storage", carregarContexto);
    };
  }, [logoUrl]);

  function alterarObraAtiva(valor: string) {
    const novoId = valor ? Number(valor) : null;

    setObraAtivaId(novoId);
    salvarObraAtivaId(novoId);
  }

  return (
    <main className="h-screen overflow-hidden bg-slate-100 text-slate-900">
      <div className="flex h-screen">
        <aside className="hidden w-60 shrink-0 flex-col justify-between bg-slate-950 p-4 text-white lg:flex">
          <div>
            <div className="mb-8 border-b border-slate-800 pb-5">
              <h1 className="text-2xl font-bold tracking-tight">ObraBoard</h1>
              <p className="mt-1 text-xs text-slate-400">
                Gestão operacional
              </p>
            </div>

            <nav className="space-y-2">
              {menuItems.map((item) => (
                <MenuLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                />
              ))}
            </nav>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-3">
              <label className="block">
                <span className="mb-2 block text-[11px] font-bold uppercase text-slate-500">
                  Obra ativa
                </span>
                <select
                  value={obraAtivaId ?? ""}
                  onChange={(e) => alterarObraAtiva(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm font-semibold text-white"
                >
                  <option value="">
                    {obras.length === 0 ? "Cadastre uma obra" : "Selecionar obra"}
                  </option>

                  {obras.map((obra) => (
                    <option key={obra.id} value={obra.id}>
                      {obra.nome || obra.codigo || "Obra sem nome"}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 flex min-h-16 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-3">
              {logoExibido ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoExibido}
                  alt="Logo da empresa"
                  className="max-h-24 max-w-full object-contain"
                />
              ) : (
                <div className="flex h-14 w-full items-center justify-center rounded-lg bg-white/10 text-xs font-semibold text-slate-400">
                  LOGO
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 text-sm font-bold">
                LV
              </div>

              <div>
                <p className="text-sm font-semibold">Luis Villaca</p>
                <p className="text-xs text-slate-400">Planejador</p>
              </div>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1 overflow-auto p-3 lg:p-6">
          <header className="mb-6 rounded-xl bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-3xl font-bold">{titulo}</h2>

                {subtitulo && (
                  <p className="mt-1 text-slate-500">{subtitulo}</p>
                )}
              </div>

              <div className="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-700">
                {status}
              </div>
            </div>
          </header>

          {children}
        </section>
      </div>
    </main>
  );
}

function MenuLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: string;
}) {
  const pathname = usePathname();

  const ativo = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
        ativo
          ? "bg-teal-500 text-white shadow-sm"
          : "text-slate-300 hover:bg-slate-800 hover:text-white"
      }`}
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-sm">
        {icon}
      </span>

      <span>{label}</span>
    </Link>
  );
}
