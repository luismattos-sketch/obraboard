"use client";

import "./globals.css";
import { TelaErro } from "@/components/ui/TelaErro";

export default function ErroGlobal({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="pt-BR">
      <body className="bg-fundo">
        <TelaErro tentar={unstable_retry} />
      </body>
    </html>
  );
}
