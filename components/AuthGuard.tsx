"use client";

import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [autorizado, setAutorizado] = useState(
    pathname === "/login" || pathname === "/campo"
  );

  useEffect(() => {
    let ativo = true;
    const rotaPublica = pathname === "/login" || pathname === "/campo";

    if (rotaPublica) {
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
