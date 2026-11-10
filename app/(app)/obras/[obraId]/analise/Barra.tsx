/** Barra horizontal simples (0..1) com rótulo à esquerda e texto à direita. */
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
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className={`w-28 shrink-0 truncate text-sm ${destaque ? "font-semibold text-texto" : "text-texto-suave"}`}>
        {rotulo}
      </span>
      <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-primaria-clara" aria-hidden="true">
        <span
          className={`block h-full rounded-full ${destaque ? "bg-destaque" : "bg-primaria"}`}
          style={{ width: `${largura}%` }}
        />
      </span>
      <span className={`w-20 shrink-0 text-right text-sm ${destaque ? "font-semibold text-texto" : "text-texto"}`}>
        {texto}
      </span>
    </div>
  );
}
