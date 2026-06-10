"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  apagarCadastroBase,
  cadastroBaseEvento,
  carregarCadastroBase,
  getContextoAtual,
  salvarObraAtivaId,
  sincronizarCadastroBaseRemoto,
  type ObraCadastrada,
} from "../lib/cadastro-base";
import { criarRotaComObra, gerarCampoUrl } from "../lib/rotas";
import { supabase } from "../lib/supabase";

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
  status,
  statusTom = "andamento",
  infoCentral,
  detalheCentral,
  logoUrl,
}: Props) {
  const [logoSalvo, setLogoSalvo] = useState("");
  const [obras, setObras] = useState<ObraCadastrada[]>([]);
  const [obraAtivaId, setObraAtivaId] = useState<number | null>(null);
  const [turnoAtivoId, setTurnoAtivoId] = useState<number | null>(null);
  const [campoToken, setCampoToken] = useState<string | null>(null);
  const [appAdmin, setAppAdmin] = useState(false);
  const [usuarioNome, setUsuarioNome] = useState("Usuário");
  const [usuarioFuncao, setUsuarioFuncao] = useState("Função não informada");
  const pathname = usePathname();
  const logoExibido = logoUrl ?? logoSalvo;
  const usuarioIniciais = obterIniciaisUsuario(usuarioNome);
  const campoHref = gerarCampoUrl({ token: campoToken });
  const itensMenu = [
    ...menuItems,
    ...(appAdmin
      ? [{ href: "/admin/users", label: "Usuários", icon: "AD" }]
      : []),
  ].map((item) => ({
    ...item,
    href: criarRotaComObra(item.href, obraAtivaId),
  }));
  const classeStatus =
    statusTom === "planejado"
      ? "bg-blue-100 text-blue-700"
      : statusTom === "encerrado"
      ? "bg-slate-200 text-slate-700"
      : "bg-green-100 text-green-700";
  const itensMobile = [...itensMenu, { href: campoHref, label: "Campo", icon: "CP" }];

  useEffect(() => {
    void supabase.rpc("is_app_admin").then(({ data }) => {
      setAppAdmin(Boolean(data));
    });
  }, []);

  useEffect(() => {
    function atualizarUsuario(
      usuario: {
        email?: string | null;
        user_metadata?: Record<string, unknown>;
      } | null
    ) {
      const metadata = usuario?.user_metadata ?? {};
      const nome =
        obterTextoMetadata(metadata.nome) ||
        obterTextoMetadata(metadata.name) ||
        obterTextoMetadata(metadata.full_name) ||
        usuario?.email?.split("@")[0] ||
        "Usuário";
      const funcao =
        obterTextoMetadata(metadata.funcao) ||
        obterTextoMetadata(metadata.function) ||
        "Função não informada";

      setUsuarioNome(nome);
      setUsuarioFuncao(funcao);
    }

    void supabase.auth.getUser().then(({ data }) => {
      atualizarUsuario(data.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      atualizarUsuario(sessao?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function carregarContexto(cadastro = carregarCadastroBase()) {
      const contexto = getContextoAtual(cadastro);
      const obraAtiva = contexto.obraAtiva;

      if (logoUrl === undefined) {
        setLogoSalvo(obraAtiva?.logoUrl || cadastro.logoUrl);
      }

      setObras(cadastro.obras);
      setObraAtivaId(contexto.obraAtivaId);
      setTurnoAtivoId(contexto.turnoAtivoId);
    }

    queueMicrotask(() => {
      void sincronizarCadastroBaseRemoto().then(carregarContexto);
    });
    const carregarContextoLocal = () => {
      carregarContexto();
    };
    window.addEventListener(cadastroBaseEvento, carregarContextoLocal);

    return () => {
      window.removeEventListener(cadastroBaseEvento, carregarContextoLocal);
    };
  }, [logoUrl]);

  useEffect(() => {
    if (!obraAtivaId || !turnoAtivoId) {
      queueMicrotask(() => setCampoToken(null));
      return;
    }

    void supabase
      .from("turnos_operacao")
      .select("public_token")
      .eq("obra_id", obraAtivaId)
      .eq("turno_id", turnoAtivoId)
      .not("publicado_em", "is", null)
      .not("status", "in", "(cancelado,cancelled)")
      .order("data_turno", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setCampoToken(
          (data as { public_token?: string | null } | null)?.public_token ?? null
        );
      });
  }, [obraAtivaId, turnoAtivoId]);

  function alterarObraAtiva(valor: string) {
    const novoId = valor ? Number(valor) : null;

    setObraAtivaId(novoId);
    atualizarObraIdNaUrl(pathname, novoId);
    void salvarObraAtivaId(novoId);
  }

  function apagarDadosEntrada() {
    const confirmou = window.confirm(
      "Tem certeza que deseja apagar todos os dados de entrada cadastrados? Esta ação não pode ser desfeita."
    );

    if (!confirmou) {
      return;
    }

    apagarCadastroBase();
    setLogoSalvo("");
    setObras([]);
    setObraAtivaId(null);
    setTurnoAtivoId(null);
    limparContextoNaUrl(pathname);
  }

  return (
    <main className="h-screen overflow-hidden bg-slate-100 text-slate-900 print:h-auto print:overflow-visible print:bg-white">
      <div className="flex h-screen print:block print:h-auto">
        <aside className="hidden w-60 shrink-0 flex-col justify-between bg-slate-950 p-4 text-white print:hidden lg:flex">
          <div>
            <div className="mb-8 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/frentia-logo.png"
                alt="Frentia"
                className="frentia-logo-img frentia-logo-img-invert mx-auto h-14 w-auto"
              />
              <div className="mt-4 border-t border-slate-800" />
              <p className="mt-3 text-xs text-slate-400">
                Gestão operacional
              </p>
            </div>

            <nav className="space-y-2">
              {itensMenu.map((item) => (
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

          <div className="space-y-3">
            <button
              type="button"
              onClick={apagarDadosEntrada}
              className="w-full rounded-lg border border-slate-800 px-3 py-2 text-left text-xs font-semibold text-slate-500 transition hover:border-red-900/70 hover:bg-red-950/30 hover:text-red-200"
            >
              Apagar dados de entrada
            </button>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 text-sm font-bold">
                  {usuarioIniciais}
                </div>

                <div>
                  <p className="text-sm font-semibold">{usuarioNome}</p>
                  <p className="text-xs text-slate-400">{usuarioFuncao}</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1 overflow-auto p-3 print:overflow-visible print:p-0 lg:p-6">
          <div className="mb-4 rounded-xl bg-slate-950 p-3 text-white shadow-sm print:hidden lg:hidden">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/frentia-logo.png"
                  alt="Frentia"
                  className="frentia-logo-img frentia-logo-img-invert h-7 w-auto"
                />
                <p className="text-xs text-slate-400">Gestão operacional</p>
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
                  key={item.href ?? item.label}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  compact
                  disabledText="Publique um turno no Check-in"
                />
              ))}
            </nav>
          </div>

          <header className="mb-6 rounded-xl bg-white p-4 shadow-sm print:hidden lg:p-5">
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

              {status && (
                <div className={`justify-self-start rounded-full px-4 py-2 text-sm font-semibold lg:justify-self-end ${classeStatus}`}>
                  {status}
                </div>
              )}
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
  disabledText,
}: {
  href: string | null;
  label: string;
  icon: string;
  compact?: boolean;
  disabledText?: string;
}) {
  const pathname = usePathname();
  const classeBase = `flex items-center gap-3 rounded-xl text-sm font-semibold transition ${
    compact ? "shrink-0 px-3 py-2" : "px-4 py-3"
  }`;

  if (!href) {
    return (
      <span
        title={disabledText}
        className={`${classeBase} cursor-not-allowed text-slate-500`}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-sm">
          {icon}
        </span>

        <span>{label}</span>
      </span>
    );
  }

  const hrefPathname = obterPathnameHref(href);

  const ativo =
    hrefPathname === "/" ? pathname === "/" : pathname.startsWith(hrefPathname);

  return (
    <Link
      href={href}
      className={`${classeBase} ${
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

function obterPathnameHref(href: string) {
  try {
    return new URL(href).pathname;
  } catch {
    return href.split("?")[0];
  }
}

function atualizarObraIdNaUrl(pathname: string, obraId: number | null) {
  const params = new URLSearchParams(window.location.search);

  if (obraId) {
    params.set("obraId", String(obraId));
  } else {
    params.delete("obraId");
  }

  const query = params.toString();
  window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
}

function limparContextoNaUrl(pathname: string) {
  const params = new URLSearchParams(window.location.search);
  params.delete("obraId");
  params.delete("turnoId");

  const query = params.toString();
  window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
}

function obterTextoMetadata(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

function obterIniciaisUsuario(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);

  if (partes.length === 0) {
    return "US";
  }

  const primeira = partes[0][0] ?? "";
  const ultima = partes.length > 1 ? partes.at(-1)?.[0] ?? "" : partes[0][1] ?? "";

  return `${primeira}${ultima}`.toUpperCase();
}
