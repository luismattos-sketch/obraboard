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

    void supabase.auth.getUser().then(({ data }) => {
      if (!ativo) {
        return;
      }

      if (!data.user) {
        setAutorizado(false);
        router.replace("/login");
        return;
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
    pathname === "/auth/callback"
  );
}
