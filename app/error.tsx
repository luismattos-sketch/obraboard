"use client";

import { TelaErro } from "@/components/ui/TelaErro";

export default function Erro({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <TelaErro tentar={unstable_retry} />;
}
