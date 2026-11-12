import { Cartao } from "@/components/ui/Cartao";
import { formatarData, formatarPercentual, numeroBR, ROTULO_PERIODO } from "@/lib/dominio/formato";
import {
  encerramentoLiberado,
  type ResumoSemana,
  type Semana,
} from "@/lib/dominio/programacao";
import type { ResponsavelRef } from "@/lib/dominio/quadro";
import { FormEncerrar } from "./FormEncerrar";
import { FormReabrir } from "./FormReabrir";
import { GradeSemana } from "./GradeSemana";
import { PrevistoReal } from "./PrevistoReal";

export function Acompanhamento({ semana, resumo, hoje, responsaveis }: { semana: Semana; resumo: ResumoSemana; hoje: string; responsaveis: ResponsavelRef[] }) {
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
        <GradeSemana atividades={resumo.atividades} encerrada={encerrada} responsaveis={responsaveis} />
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
