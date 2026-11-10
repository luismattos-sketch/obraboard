import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Cartao } from "./Cartao";

export function CascaAuth({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
      <Link href="/" aria-label="Frentia, página inicial">
        <Image src="/frentia-logo.png" alt="Frentia" width={160} height={41} priority />
      </Link>
      <Cartao className="w-full max-w-sm">
        <h1 className="mb-4 text-titulo font-semibold text-primaria">{titulo}</h1>
        {children}
      </Cartao>
    </main>
  );
}
