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
  sincronizarCadastroBaseRemoto,
  type ObraCadastrada,
} from "../lib/cadastro-base";

interface Props {
  children: ReactNode;
  titulo: string;
  subtitulo?: string;
  status?: string;
  statusTom?: "planejado" | "andamento" | "encerrado";
  infoCentral?: string;
  detalheCentral?: string;
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
  statusTom = "andamento",
  infoCentral,
  detalheCentral,
  logoUrl,
}: Props) {
  const [logoSalvo, setLogoSalvo] = useState("");
  const [obras, setObras] = useState<ObraCadastrada[]>([]);
  const [obraAtivaId, setObraAtivaId] = useState<number | null>(null);
  const logoExibido = logoUrl ?? logoSalvo;
  const campoHref = obraAtivaId ? `/campo?obraId=${obraAtivaId}` : "/campo";
  const classeStatus =
    statusTom === "planejado"
      ? "bg-blue-100 text-blue-700"
      : statusTom === "encerrado"
      ? "bg-slate-200 text-slate-700"
      : "bg-green-100 text-green-700";
  const itensMobile = [...menuItems, { href: campoHref, label: "Campo", icon: "CP" }];

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

    queueMicrotask(() => {
      carregarContexto();
      void sincronizarCadastroBaseRemoto();
    });
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

              <div className="mt-3">
                <MenuLink href={campoHref} label="Campo" icon="CP" />
              </div>
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
          <div className="mb-4 rounded-xl bg-slate-950 p-3 text-white shadow-sm lg:hidden">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-bold tracking-tight">ObraBoard</h1>
                <p className="text-xs text-slate-400">Gestao operacional</p>
              </div>

              {logoExibido ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoExibido}
                  alt="Logo da empresa"
                  className="max-h-10 max-w-20 object-contain"
                />
              ) : (
                <div className="flex h-9 w-14 items-center justify-center rounded-lg bg-white/10 text-[10px] font-semibold text-slate-400">
                  LOGO
                </div>
              )}
            </div>

            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">
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

            <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {itensMobile.map((item) => (
                <MenuLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  compact
                />
              ))}
            </nav>
          </div>

          <header className="mb-6 rounded-xl bg-white p-4 shadow-sm lg:p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
              <div>
                <h2 className="text-2xl font-bold lg:text-3xl">{titulo}</h2>

                {subtitulo && (
                  <p className="mt-1 text-slate-500">{subtitulo}</p>
                )}
              </div>

              {(infoCentral || detalheCentral) && (
                <div className="flex flex-wrap items-center justify-center gap-2 text-center">
                  {infoCentral && (
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-2xl font-bold tabular-nums text-slate-900">
                      {infoCentral}
                    </div>
                  )}

                  {detalheCentral && (
                    <div className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                      {detalheCentral}
                    </div>
                  )}
                </div>
              )}

              <div className={`justify-self-start rounded-full px-4 py-2 text-sm font-semibold lg:justify-self-end ${classeStatus}`}>
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
  compact = false,
}: {
  href: string;
  label: string;
  icon: string;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const hrefPathname = href.split("?")[0];

  const ativo =
    hrefPathname === "/" ? pathname === "/" : pathname.startsWith(hrefPathname);

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl text-sm font-semibold transition ${
        compact ? "shrink-0 px-3 py-2" : "px-4 py-3"
      } ${
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
