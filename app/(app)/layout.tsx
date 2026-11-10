import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Botao } from "@/components/ui/Botao";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { sair } from "../(publico)/auth-acoes";

export default async function LayoutApp({ children }: { children: ReactNode }) {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect("/login");
  const nome = (user.user_metadata?.nome as string | undefined) || user.email || "";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-borda bg-superficie px-4 py-3">
        <Link href="/obras" aria-label="Frentia, suas obras">
          <Image src="/frentia-logo.png" alt="Frentia" width={110} height={28} priority />
        </Link>
        <div className="flex items-center gap-3">
          <span className="max-w-32 truncate text-sm text-texto-suave sm:max-w-64">{nome}</span>
          <form action={sair}>
            <Botao type="submit" variante="secundario" className="min-h-10 px-3 text-sm">Sair</Botao>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
