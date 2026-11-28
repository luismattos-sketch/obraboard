import Link from "next/link";
import { classesBotao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import type { Passo, SituacaoPasso } from "@/lib/dominio/roteiro";
import type { Tom } from "@/lib/dominio/tipos";

const SINAL: Record<SituacaoPasso, { tom: Tom; texto: string; rotulo: string }> = {
  feito: { tom: "sucesso", texto: "✓", rotulo: "Feito" },
  pendente: { tom: "neutro", texto: "○", rotulo: "Pendente" },
  atencao: { tom: "alerta", texto: "!", rotulo: "Atenção" },
};

/** Item 5.4: roteiro da semana (LPS conduzido) no topo da página da obra. */
export function RoteiroSemana({ obraId, titulo, passos }: { obraId: string; titulo: string; passos: Passo[] }) {
  return (
    <Cartao className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-primaria">Roteiro da semana <span className="font-normal text-texto-suave">· {titulo}</span></h2>
        <Link href={`/obras/${obraId}/reuniao`} className={classesBotao("secundario")}>Abrir pauta da reunião</Link>
      </div>
      <ol className="flex flex-col divide-y divide-borda">
        {passos.map((p) => (
          <li key={p.id} className="flex flex-col gap-1 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span aria-label={SINAL[p.situacao].rotulo} title={SINAL[p.situacao].rotulo}>
                  <Selo tom={SINAL[p.situacao].tom}>{SINAL[p.situacao].texto}</Selo>
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">{p.titulo}</p>
                  <p className="text-sm text-texto-suave">{p.detalhe}</p>
                </div>
              </div>
              <Link href={p.href} className="text-sm font-semibold text-operacional underline">{p.rotuloBotao}</Link>
            </div>
            <details className="text-sm text-texto-suave">
              <summary className="cursor-pointer">Por que isso?</summary>
              <p className="mt-1">
                {p.porque} <Link href={`/ajuda/metodo-lps#${p.ajuda}`} className="text-operacional underline">Saiba mais</Link>
              </p>
            </details>
          </li>
        ))}
      </ol>
    </Cartao>
  );
}
