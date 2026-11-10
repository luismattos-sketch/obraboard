/** Barra horizontal simples (0..1): rótulo em linha própria (quebra, nunca corta) e barra + texto abaixo.
 * Só elementos de frase, para poder ficar dentro de <summary>. */
export function Barra({
  rotulo,
  fracao,
  texto,
  destaque = false,
}: {
  rotulo: string;
  fracao: number | null;
  texto: string;
  destaque?: boolean;
}) {
  const largura = fracao === null ? 0 : Math.max(0, Math.min(1, fracao)) * 100;
  const tomTexto = destaque ? "font-semibold text-texto" : "text-texto";
  return (
    <span className="flex min-w-0 flex-col gap-1 py-1">
      <span className={`text-sm break-words ${destaque ? "font-semibold text-texto" : "text-texto-suave"}`}>{rotulo}</span>
      <span className="flex min-w-0 items-center gap-3">
        <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-primaria-clara" aria-hidden="true">
          <span
            className={`block h-full rounded-full ${destaque ? "bg-destaque" : "bg-primaria"}`}
            style={{ width: `${largura}%` }}
          />
        </span>
        <span className={`shrink-0 text-right text-sm whitespace-nowrap ${tomTexto}`}>{texto}</span>
      </span>
    </span>
  );
}
