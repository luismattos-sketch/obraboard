import { classesBotao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { Expansivel } from "@/components/ui/Expansivel";
import { Selo } from "@/components/ui/Selo";
import type { GrupoRdo } from "@/lib/dominio/historico-rdo";
import { formatarData, formatarPercentual, ROTULO_PERIODO } from "@/lib/dominio/formato";
import { dataHoraCurta } from "@/lib/rdo/formatar";

const linkVersao = (id: string) => `/api/rdo/versao/${id}`;

/** Lista de RDOs oficiais: uma linha por turno, versões anteriores no expansível. */
export function ListaRdos({ grupos, mostrarObra }: { grupos: GrupoRdo[]; mostrarObra: boolean }) {
  if (grupos.length === 0) {
    return (
      <Cartao>
        <p className="text-texto-suave">Nenhum RDO emitido ainda. O RDO é registrado quando você fecha um turno.</p>
      </Cartao>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {grupos.map((g) => (
        <li key={g.turnoId}>
          <Cartao className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                {mostrarObra && <p className="truncate text-sm font-semibold text-primaria">{g.obraNome}</p>}
                <p className="font-semibold text-texto">{formatarData(g.data)}</p>
                <p className="text-sm text-texto-suave">{ROTULO_PERIODO[g.periodo]}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-texto">{formatarPercentual(g.atual.percentual)}</span>
                <Selo tom="neutro">v{g.atual.numero}</Selo>
                {g.reaberto && <Selo tom="alerta">Turno reaberto</Selo>}
                <a href={linkVersao(g.atual.id)} className={classesBotao("secundario")}>Baixar</a>
              </div>
            </div>
            {g.anteriores.length > 0 && (
              <Expansivel resumo={<span className="text-sm text-texto-suave">Versões anteriores ({g.anteriores.length})</span>}>
                <ul className="mt-2 flex flex-col gap-1 pl-5 text-sm">
                  {g.anteriores.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center gap-2">
                      <span>v{v.numero} · emitida {dataHoraCurta(new Date(v.emitidoEm))}</span>
                      <a href={linkVersao(v.id)} className="text-operacional underline">Baixar</a>
                    </li>
                  ))}
                </ul>
              </Expansivel>
            )}
          </Cartao>
        </li>
      ))}
    </ul>
  );
}
