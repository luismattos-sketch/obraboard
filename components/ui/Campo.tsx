import { useId, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & { rotulo: string; erro?: string };

export function Campo({ rotulo, erro, className = "", id, ...resto }: Props) {
  const gerado = useId();
  const idCampo = id ?? gerado;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={idCampo} className="text-sm font-medium text-texto">
        {rotulo}
      </label>
      <input
        {...resto}
        id={idCampo}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${idCampo}-erro` : undefined}
        className={`min-h-12 rounded-botao border bg-superficie px-3 text-base text-texto focus-visible:outline-2 focus-visible:outline-operacional ${erro ? "border-perigo" : "border-borda"} ${className}`}
      />
      {erro && (
        <p id={`${idCampo}-erro`} className="text-sm text-perigo">
          {erro}
        </p>
      )}
    </div>
  );
}
