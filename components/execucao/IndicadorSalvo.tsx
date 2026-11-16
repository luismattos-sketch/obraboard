import type { EstadoSalvar } from "./useAutoSalvar";

type Props = EstadoSalvar & {
  /** Conflito: carrega no bloco os valores gravados agora (ver Sincronizar.recarregar). */
  onVerAtual?: () => void;
  /** Depois de "Ver valor atual": o que a pessoa tinha digitado, até a próxima edição. */
  nota?: string | null;
};

export function IndicadorSalvo({ estado, mensagem, conflito, onVerAtual, nota }: Props) {
  if (estado === "ocioso") return nota ? <p className="text-sm text-texto-suave">{nota}</p> : null;
  if (estado === "salvando") return <p className="text-sm text-texto-suave" aria-live="polite">Salvando…</p>;
  if (estado === "salvo") return <p className="text-sm text-sucesso" aria-live="polite">Salvo ✓</p>;
  if (conflito && onVerAtual) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-botao border border-alerta bg-alerta-clara p-3" role="alert">
        <p className="text-sm text-texto">{mensagem}</p>
        <button
          type="button"
          className="min-h-12 rounded-botao border border-operacional bg-superficie px-4 font-semibold text-primaria hover:bg-primaria-clara"
          onClick={onVerAtual}
        >
          Ver valor atual
        </button>
      </div>
    );
  }
  return (
    <p className="text-sm text-perigo" role="alert">
      {mensagem ?? "Sem conexão — tentando de novo"}
    </p>
  );
}
