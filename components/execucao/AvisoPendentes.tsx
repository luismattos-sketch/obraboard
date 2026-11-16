import { textoPendentes } from "./repeticao";

/** Faixa fixa no alto da tela enquanto algum lançamento falhou ao salvar (sem sinal). */
export function AvisoPendentes({ falhas, tentar }: { falhas: number; tentar: () => void }) {
  if (falhas === 0) return null;
  return (
    <div
      role="alert"
      className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 rounded-botao border border-alerta bg-alerta-clara p-3 text-alerta-escura shadow-sm"
    >
      <p className="font-semibold">{textoPendentes(falhas)}</p>
      <button
        type="button"
        className="min-h-12 rounded-botao border border-alerta-escura bg-superficie px-4 font-semibold text-alerta-escura"
        onClick={tentar}
      >
        Tentar de novo
      </button>
    </div>
  );
}
