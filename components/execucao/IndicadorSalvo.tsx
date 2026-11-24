import { MSG_SEM_SINAL } from "./repeticao";
import type { EstadoSalvar } from "./useAutoSalvar";

type Props = EstadoSalvar & {
  /** Conflito: carrega no bloco os valores gravados agora (ver Sincronizar.recarregar). */
  onVerAtual?: () => void;
  /** Depois de "Ver valor atual": o que a pessoa tinha digitado, até a próxima edição. */
  nota?: string | null;
  /** Falha de rede: tentar já (sem esperar o próximo intervalo). */
  tentar?: () => void;
  /** Texto curto quando não há nada acontecendo (ex.: "salva sozinho"). */
  dica?: string;
};

export function IndicadorSalvo({ estado, mensagem, conflito, onVerAtual, nota, tentar, dica }: Props) {
  if (estado === "ocioso") {
    if (nota) return <p className="text-sm text-texto-suave">{nota}</p>;
    return dica ? <p className="text-sm text-texto-suave">{dica}</p> : null;
  }
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
  if (mensagem === undefined) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-botao border border-perigo bg-perigo-clara p-3" role="alert">
        <p className="text-base font-semibold text-perigo">⚠ {MSG_SEM_SINAL}</p>
        {tentar && (
          <button
            type="button"
            className="min-h-12 rounded-botao border border-operacional bg-superficie px-4 font-semibold text-primaria hover:bg-primaria-clara"
            onClick={tentar}
          >
            Tentar de novo
          </button>
        )}
      </div>
    );
  }
  return (
    <p className="text-sm text-perigo" role="alert">
      {mensagem}
    </p>
  );
}
