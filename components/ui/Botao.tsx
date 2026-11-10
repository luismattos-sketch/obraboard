import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primario" | "secundario" | "perigo";
  carregando?: boolean;
};

const estilos = {
  primario: "bg-primaria text-white hover:bg-primaria-escura",
  secundario: "bg-superficie text-primaria border border-borda hover:bg-primaria-clara",
  perigo: "bg-perigo text-white hover:opacity-90",
};

export const classesBotao = (variante: keyof typeof estilos = "primario") =>
  `inline-flex min-h-12 items-center justify-center rounded-lg px-5 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destaque disabled:cursor-not-allowed disabled:opacity-60 ${estilos[variante]}`;

export function Botao({ variante = "primario", carregando, disabled, className = "", children, ...resto }: Props) {
  return (
    <button
      {...resto}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={`${classesBotao(variante)} ${className}`}
    >
      {carregando ? "Aguarde..." : children}
    </button>
  );
}
