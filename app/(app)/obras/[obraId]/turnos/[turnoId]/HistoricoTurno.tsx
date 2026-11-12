import { Aviso } from "@/components/ui/Aviso";
import { Cartao } from "@/components/ui/Cartao";
import { Expansivel } from "@/components/ui/Expansivel";
import { rotuloAtor, rotuloEvento, type EventoTurno } from "@/lib/dominio/eventos";
import { dataHoraCurta } from "@/lib/rdo/formatar";

type Props = {
  eventos: EventoTurno[] | null;
  versoes: { id: string; numero: number }[];
  /** Página da foto do check-in (null = turno liberado antes do registro oficial). */
  checkinHref?: string | null;
};

export const NOTA_INICIO = "Histórico registrado a partir de 10/11/2026";

/** Linha do tempo dos marcos do turno (recolhida). `eventos = null` indica falha de leitura. */
export function HistoricoTurno({ eventos, versoes, checkinHref = null }: Props) {
  if (eventos === null) {
    return <Aviso tom="perigo">Não foi possível carregar o histórico.</Aviso>;
  }
  const semInicio = !eventos.some((e) => e.tipo === "criado");
  return (
    <Cartao>
      <Expansivel resumo={<span className="font-semibold text-texto">{`Histórico (${eventos.length})`}</span>}>
        <div className="mt-3 flex flex-col gap-2 text-sm">
          {semInicio && <p className="text-texto-suave">{NOTA_INICIO}</p>}
          <ol className="flex flex-col gap-2">
            {eventos.map((e) => {
              const hora = dataHoraCurta(new Date(e.em));
              const ator = rotuloAtor(e);
              const versao = e.tipo === "fechado" ? versoes.find((v) => v.numero === e.versao) : undefined;
              return (
                <li key={e.id} className="flex flex-col">
                  {versao ? (
                    <span>
                      {`${hora} · Fechado · `}
                      <a href={`/api/rdo/versao/${versao.id}`} className="text-operacional underline">{`RDO v${versao.numero}`}</a>
                      {` emitido · ${ator}`}
                    </span>
                  ) : e.tipo === "liberado" && checkinHref ? (
                    <span>
                      {`${hora} · `}
                      <a href={checkinHref} className="text-operacional underline">Check-in registrado</a>
                      {` · ${ator}`}
                    </span>
                  ) : (
                    <span>{`${hora} · ${rotuloEvento(e)} · ${ator}`}</span>
                  )}
                  {e.tipo === "reaberto" && e.motivo && <span className="text-xs text-texto-suave">{`Motivo: ${e.motivo}`}</span>}
                </li>
              );
            })}
          </ol>
        </div>
      </Expansivel>
    </Cartao>
  );
}
