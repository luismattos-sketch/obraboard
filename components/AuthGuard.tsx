"use client";

import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [autorizado, setAutorizado] = useState(
    rotaPublica(pathname)
  );

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

      const { data: status } = await supabase.rpc("obter_status_acesso_atual");

      if (!ativo) {
        return;
      }

      if (status !== "active") {
        await supabase.auth.signOut();
        router.replace(`/acesso-bloqueado?status=${encodeURIComponent(status ?? "deleted")}`);
        return;
      }

      if (pathname.startsWith("/admin")) {
        const { data: admin } = await supabase.rpc("is_app_admin");

        if (!ativo) {
          return;
        }

        if (!admin) {
          router.replace("/");
          return;
        }
      }

      setAutorizado(true);
    });

    return () => {
      ativo = false;
    };
  }, [pathname, router]);

  if (!autorizado) {
    return null;
  }

  return children;
}

function rotaPublica(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/campo" ||
    pathname === "/auth/callback" ||
    pathname === "/acesso-bloqueado"
  );
}
