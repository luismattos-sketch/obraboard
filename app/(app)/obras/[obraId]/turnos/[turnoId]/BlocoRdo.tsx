import { classesBotao } from "@/components/ui/Botao";
import { Cartao } from "@/components/ui/Cartao";
import { dataHoraCurta } from "@/lib/rdo/formatar";

type Versao = { id: string; numero: number; emitido_em: string };
type Props = { turnoId: string; fechado: boolean; versoes: Versao[] };

const linkVersao = (id: string) => `/api/rdo/versao/${id}`;

/** Downloads do RDO: versão oficial (turno fechado) ou prévia em rascunho (turno aberto). */
export function BlocoRdo({ turnoId, fechado, versoes }: Props) {
  const ordenadas = [...versoes].sort((a, b) => a.numero - b.numero);
  const ultima = ordenadas.at(-1);

  if (fechado && ultima) {
    const anteriores = ordenadas.slice(0, -1).reverse();
    return (
      <Cartao className="flex flex-col gap-2">
        <a href={linkVersao(ultima.id)} className={`${classesBotao("secundario")} self-start`}>
          Baixar RDO (v{ultima.numero})
        </a>
        {anteriores.length > 0 && (
          <p className="text-sm text-texto-suave">
            Versões anteriores:{" "}
            {anteriores.map((v, i) => (
              <span key={v.id}>
                {i > 0 && ", "}
                <a href={linkVersao(v.id)} className="text-operacional underline">
                  v{v.numero} ({dataHoraCurta(new Date(v.emitido_em))})
                </a>
              </span>
            ))}
          </p>
        )}
      </Cartao>
    );
  }

  return (
    <Cartao className="flex flex-col gap-2 sm:flex-row">
      <a href={`/api/rdo/${turnoId}`} className={classesBotao("secundario")}>
        Baixar prévia (rascunho)
      </a>
      {ultima && (
        <a href={linkVersao(ultima.id)} className={classesBotao("secundario")}>
          Baixar v{ultima.numero} oficial
        </a>
      )}
    </Cartao>
  );
}
