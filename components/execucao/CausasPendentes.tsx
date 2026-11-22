"use client";

import { Aviso } from "@/components/ui/Aviso";
import { numeroBR } from "@/lib/dominio/formato";
import type { AtividadeExec } from "@/lib/dominio/tipos";

type Pendente = AtividadeExec & { unidade: string };

/** "Montagem (3 de 8 tubo)": o que foi feito do previsto (sem lançamento = 0). */
export function linhaPendente(a: Pendente): string {
  return `${a.descricao} (${numeroBR(a.qtd_realizada ?? 0)} de ${numeroBR(a.qtd_planejada)} ${a.unidade})`;
}

function irPara(id: string) {
  const el = document.getElementById(`causa-${id}`);
  if (!el) return;
  el.scrollIntoView({ block: "center" });
  el.focus();
}

/** Lista o que falta de causa na hora da cobrança (Terminei / Enviar / Fechar), com atalho até o campo. */
export function CausasPendentes({
  titulo,
  pendentes,
  aoIr,
}: {
  titulo: string;
  pendentes: Pendente[];
  /** Abre os campos de causa na tela (cobrança) antes de rolar até o card. */
  aoIr?: () => void;
}) {
  if (pendentes.length === 0) return null;
  return (
    <Aviso tom="alerta">
      <p className="font-medium">{titulo}</p>
      <ul className="mt-1 flex flex-col gap-1">
        {pendentes.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-2">
            <span>{linhaPendente(a)}</span>
            <button
              type="button"
              aria-label={`Ir para a causa: ${a.descricao}`}
              className="min-h-11 shrink-0 px-3 font-semibold underline"
              onClick={() => {
                aoIr?.();
                // Espera o card abrir o campo (próximo desenho) antes de rolar.
                requestAnimationFrame(() => requestAnimationFrame(() => irPara(a.id)));
              }}
            >
              ir
            </button>
          </li>
        ))}
      </ul>
    </Aviso>
  );
}
