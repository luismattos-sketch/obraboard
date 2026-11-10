import type { EstadoSalvar } from "./useAutoSalvar";

export function IndicadorSalvo({ estado, mensagem }: EstadoSalvar) {
  if (estado === "ocioso") return null;
  if (estado === "salvando") return <p className="text-sm text-texto-suave" aria-live="polite">Salvando…</p>;
  if (estado === "salvo") return <p className="text-sm text-sucesso" aria-live="polite">Salvo ✓</p>;
  return (
    <p className="text-sm text-perigo" role="alert">
      {mensagem ?? "Sem conexão — tentando de novo"}
    </p>
  );
}
