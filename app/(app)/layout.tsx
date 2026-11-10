import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { MenuLateral } from "@/components/navegacao/MenuLateral";
import { listarObras } from "@/lib/db/obras";
import { COOKIE_MENU, menuRecolhido } from "@/lib/dominio/navegacao";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export default async function LayoutApp({ children }: { children: ReactNode }) {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect("/login");
  const nome = (user.user_metadata?.nome as string | undefined) || user.email || "";

  const [obras, cookieStore] = await Promise.all([listarObras(supabase), cookies()]);

  return (
    <MenuLateral
      obras={obras.map((o) => ({ id: o.id, nome: o.nome }))}
      nome={nome}
      recolhidoInicial={menuRecolhido(cookieStore.get(COOKIE_MENU)?.value)}
    >
      {children}
    </MenuLateral>
  );
}
