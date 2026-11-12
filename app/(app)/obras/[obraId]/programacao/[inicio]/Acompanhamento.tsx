import { Cartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import { formatarData, formatarPercentual, numeroBR, ROTULO_PERIODO } from "@/lib/dominio/formato";
import {
  encerramentoLiberado,
  resumoDias,
  resumoEquipe,
  ROTULO_SITUACAO,
  TOM_SITUACAO,
  type ResumoSemana,
  type Semana,
} from "@/lib/dominio/programacao";
import { CAUSAS } from "@/lib/dominio/tipos";
import { FormEncerrar } from "./FormEncerrar";
import { FormReabrir } from "./FormReabrir";
import { PrevistoReal } from "./PrevistoReal";

export function Acompanhamento({ semana, resumo, hoje }: { semana: Semana; resumo: ResumoSemana; hoje: string }) {
  const encerrada = semana.status === "encerrada";
  const { ppc } = resumo;
  const naoCumpridas = resumo.atividades.filter((a) => a.situacao !== "cumprida");
  const podeEncerrar = !encerrada && encerramentoLiberado(resumo.atividades, semana.inicio, hoje);

  return (
    <div className="flex flex-col gap-4">
      <Cartao className="flex flex-col gap-1">
        <p className="text-sm text-texto-suave">PPC da semana{encerrada ? "" : " (provisório)"}</p>
        <p className="text-titulo font-semibold text-primaria">
          {formatarPercentual(ppc.ppc)} — {ppc.cumpridas} de {ppc.total}
        </p>
        {resumo.extras.length > 0 && (
          <p className="text-sm text-texto-suave">+{resumo.extras.length} fora da programação</p>
        )}
      </Cartao>

      <Cartao className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-primaria">Atividades programadas</h2>
        <ul className="divide-y divide-borda">
          {resumo.atividades.map((a) => {
            const un = a.unidade ? ` ${a.unidade}` : "";
            return (
              <li key={a.id} className="flex flex-col gap-1 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold text-texto">{a.descricao}</p>
                  <Selo tom={TOM_SITUACAO[a.situacao]}>{ROTULO_SITUACAO[a.situacao]}</Selo>
                </div>
                <p className="text-sm text-texto">
                  Meta {numeroBR(a.meta)}{un} · realizado {numeroBR(a.realizado)}{un} · saldo {numeroBR(a.saldo)}{un}
                </p>
                <p className="text-sm text-texto-suave">
                  {resumoDias(a.dias)} · {ROTULO_PERIODO[a.periodo]} · {resumoEquipe(a.equipe)}
                </p>
                {encerrada && a.causa && <p className="text-sm text-texto-suave">Causa: {CAUSAS[a.causa]}</p>}
              </li>
            );
          })}
        </ul>
      </Cartao>

      <Cartao className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-primaria">Fora da programação (extra)</h2>
        {resumo.extras.length === 0 ? (
          <p className="text-texto-suave">Nenhuma atividade fora da programação.</p>
        ) : (
          <ul className="divide-y divide-borda">
            {resumo.extras.map((x) => (
              <li key={x.id} className="py-2 text-sm">
                <p className="font-semibold text-texto">{x.descricao}</p>
                <p className="text-texto-suave">
                  {formatarData(x.data).slice(0, 5)} · {ROTULO_PERIODO[x.periodo]} · planejado {numeroBR(x.qtd_planejada)}
                  {x.unidade ? ` ${x.unidade}` : ""} · realizado {x.qtd_realizada === null ? "—" : numeroBR(x.qtd_realizada)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      <Cartao className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-primaria">Efetivo previsto × real</h2>
        <PrevistoReal inicio={semana.inicio} blocos={resumo.previstoReal} />
      </Cartao>

      {podeEncerrar && (
        <Cartao className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-primaria">Encerrar semana</h2>
          <FormEncerrar semanaId={semana.id} naoCumpridas={naoCumpridas} />
        </Cartao>
      )}

      <Cartao className="flex flex-col gap-3">
        {semana.motivo_reabertura && (
          <p className="text-sm text-texto-suave">Última reabertura: {semana.motivo_reabertura}</p>
        )}
        <FormReabrir semanaId={semana.id} rotulo={encerrada ? "Reabrir" : "Reabrir programação"} />
      </Cartao>
    </div>
  );
}
