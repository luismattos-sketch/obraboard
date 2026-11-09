"use client";

import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { obterPapelAcessoAtual } from "../lib/acessos";
import { limparContaAtual } from "../lib/conta";
import { podeAcessarMedicao, rotaMedicao } from "../lib/medicao-acesso";
import { validarSessaoAtual } from "../lib/sessao-unica";
import { supabase } from "../lib/supabase";
import { usuarioPodeEditarBlog } from "../lib/blog";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [autorizado, setAutorizado] = useState(
    rotaPublica(pathname)
  );
  const encerrarSessaoSubstituida = useCallback(async () => {
    limparContaAtual();
    await supabase.auth.signOut();
    router.replace("/login?sessao=encerrada");
  }, [router]);

  useEffect(() => {
    let ativo = true;
    const paginaPublica = rotaPublica(pathname);

    if (paginaPublica) {
      queueMicrotask(() => {
        if (ativo) {
          setAutorizado(true);
        }
      });
      return () => {
        ativo = false;
      };
    }

    queueMicrotask(() => {
      if (ativo) {
        setAutorizado(false);
      }
    });

    void supabase.auth.getUser().then(async ({ data }) => {
      if (!ativo) {
        return;
      }

      if (!data.user) {
        setAutorizado(false);
        router.replace("/login");
        return;
      }

      const sessaoValida = await validarSessaoAtual();

      if (!ativo) {
        return;
      }

      if (!sessaoValida) {
        await encerrarSessaoSubstituida();
        return;
      }

      const { data: status } = await supabase.rpc("obter_status_acesso_atual");

      if (!ativo) {
        return;
      }

      if (status !== "active" && pathname === "/assinatura") {
        setAutorizado(true);
        return;
      }

      if (status !== "active") {
        if (["suspended", "cancelled"].includes(String(status))) {
          router.replace(`/assinatura?status=${encodeURIComponent(status ?? "suspended")}`);
          return;
        }

        limparContaAtual();
        await supabase.auth.signOut();
        router.replace(`/acesso-bloqueado?status=${encodeURIComponent(status ?? "deleted")}`);
        return;
      }

      if (pathname === "/blog/novo") {
        if (!usuarioPodeEditarBlog(data.user.email)) {
          router.replace("/painel");
          return;
        }

        setAutorizado(true);
        return;
      }

      const medicaoAutorizada =
        rotaMedicao(pathname) && podeAcessarMedicao(data.user.email);

      if (rotaMedicao(pathname) && !medicaoAutorizada) {
        router.replace("/painel");
        return;
      }

      if (pathname.startsWith("/admin")) {
        const { data: admin } = await supabase.rpc("is_app_admin");

        if (!ativo) {
          return;
        }

        if (!admin) {
          router.replace("/painel");
          return;
        }
      }

      const papel = await obterPapelAcessoAtual();

      if (!ativo) {
        return;
      }

      if (papel === "usuario" && !medicaoAutorizada) {
        router.replace("/acesso-bloqueado?status=usuario");
        return;
      }

      if (
        papel === "planejador" &&
        !medicaoAutorizada &&
        !rotaPermitidaPlanejador(pathname)
      ) {
        router.replace("/painel");
        return;
      }

      if (
        papel === "visitante" &&
        !medicaoAutorizada &&
        !rotaPermitidaVisitante(pathname)
      ) {
        router.replace("/painel");
        return;
      }

      setAutorizado(true);
    });

    return () => {
      ativo = false;
    };
  }, [encerrarSessaoSubstituida, pathname, router]);

  useEffect(() => {
    if (rotaPublica(pathname)) {
      return;
    }

    let ativo = true;
    const intervalo = window.setInterval(() => {
      void validarSessaoAtual().then(async (sessaoValida) => {
        if (!ativo || sessaoValida) {
          return;
        }

        await encerrarSessaoSubstituida();
      });
    }, 30000);

    return () => {
      ativo = false;
      window.clearInterval(intervalo);
    };
  }, [encerrarSessaoSubstituida, pathname]);

  if (!autorizado) {
    return null;
  }

  return children;
}

function rotaPermitidaPlanejador(pathname: string) {
  return ["/obra", "/checkin", "/painel", "/checkout", "/indicadores", "/rdo", "/suporte"].some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`)
  );
}

function rotaPermitidaVisitante(pathname: string) {
  return ["/checkin", "/painel", "/checkout", "/indicadores", "/suporte"].some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`)
  );
}

function rotaPublica(pathname: string) {
  return [
    "/",
    "/login",
    "/cadastro",
    "/campo",
    "/auth/callback",
    "/acesso-bloqueado",
    "/controle-execucao-campo",
    "/planejado-vs-realizado",
    "/rdo-digital",
    "/controle-turno-obra",
    "/gestao-restricoes-obra",
    "/software-gestao-paradas-industriais",
    "/contato",
    "/privacidade",
    "/termos",
    "/blog",
  ].includes(pathname) || (pathname.startsWith("/blog/") && pathname !== "/blog/novo");
}
