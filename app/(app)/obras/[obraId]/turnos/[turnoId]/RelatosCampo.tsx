import { Selo } from "@/components/ui/Selo";
import type { Relato } from "@/lib/db/relatos";
import type { ResponsavelRef } from "@/lib/dominio/quadro";

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/** Texto original do "Conte como foi o dia": prova do que o responsável disse (a IA só organiza). */
export function RelatosCampo({ relatos, responsaveis }: { relatos: Relato[]; responsaveis: ResponsavelRef[] }) {
  if (relatos.length === 0) return null;
  const nome = (id: string) => responsaveis.find((r) => r.id === id)?.nome ?? "Responsável removido";
  return (
    <details className="rounded-cartao border border-borda bg-superficie p-4">
      <summary className="cursor-pointer text-lg font-semibold text-texto">O que o campo escreveu ({relatos.length})</summary>
      <ul className="mt-3 flex flex-col gap-3">
        {relatos.map((r) => (
          <li key={r.id} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2 text-sm text-texto-suave">
              <span>{nome(r.responsavel_id)} · {hora(r.atualizado_em)}</span>
              <Selo tom={r.lancado ? "sucesso" : "neutro"}>{r.lancado ? "lançado" : "não lançado"}</Selo>
            </div>
            <p className="whitespace-pre-wrap text-texto">{r.texto}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}
