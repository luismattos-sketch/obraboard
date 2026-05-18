"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";

interface Props {
  children: ReactNode;
  titulo: string;
  subtitulo?: string;
}

const menuItems = [
  { href: "/checkin", label: "Check-in", icon: "✓" },
  { href: "/", label: "Painel", icon: "▦" },
  { href: "/checkout", label: "Check-out", icon: "↗" },
  { href: "/rdo", label: "RDO", icon: "▤" },
];

export default function DesktopLayout({
  children,
  titulo,
  subtitulo,
}: Props) {
  return (
    <main className="h-screen overflow-hidden bg-slate-100 text-slate-900">
      <div className="flex h-screen">
        <aside className="flex w-60 flex-col justify-between bg-slate-950 p-4 text-white">
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

            <div className="mt-6 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-4 text-center">
              <div className="mx-auto mb-2 flex h-16 w-32 items-center justify-center rounded-lg bg-white/10 text-xs font-semibold text-slate-400">
                LOGO
              </div>
              <p className="text-xs text-slate-500">Logo da empresa</p>
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

        <section className="flex-1 overflow-auto p-6">
          <header className="mb-6 rounded-xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold">{titulo}</h2>

                {subtitulo && (
                  <p className="mt-1 text-slate-500">{subtitulo}</p>
                )}
              </div>

              <div className="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-700">
                Turno em andamento
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