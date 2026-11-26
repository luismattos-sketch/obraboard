import { Aviso } from "@/components/ui/Aviso";
import { ClimaTurno } from "@/components/execucao/ClimaTurno";
import type { ClimaNaTela } from "@/lib/clima/tela";
import { BuscarClima } from "./BuscarClima";
import { qtdComUnidade } from "@/lib/dominio/plural";
import { Cartao } from "@/components/ui/Cartao";
import { Selo } from "@/components/ui/Selo";
import type { TurnoCompleto } from "@/lib/db/turnos";
import { formatarPercentual, horaCurta, numeroBR } from "@/lib/dominio/formato";
import { resumirTurno, textoForaDoDia } from "@/lib/dominio/resumo";
import { ROTULO_STATUS_ATIVIDADE, type StatusAtividade, type Tom } from "@/lib/dominio/tipos";

const TOM: Record<StatusAtividade, Tom> = { concluida: "sucesso", parcial: "alerta", nao_iniciada: "neutro" };

export const EXPLICA_CUMPRIMENTO =
  "Conta só a atividade que chegou à meta do dia. A que andou parte entra no avanço físico. Extra e adiantada ficam de fora.";

function Metrica({ rotulo, valor, detalhe, explicacao }: { rotulo: string; valor: string; detalhe?: string; explicacao?: string }) {
  return (
    <Cartao className="flex flex-col gap-1">
      <p className="text-sm text-texto-suave">{rotulo}</p>
      <p className="text-3xl font-semibold text-primaria">{valor}</p>
      {detalhe && <p className="text-xs text-texto-suave">{detalhe}</p>}
      {explicacao && <p className="text-xs text-texto-suave">ⓘ {explicacao}</p>}
    </Cartao>
  );
}

export function Resumo({ turno, clima }: { turno: TurnoCompleto; clima: ClimaNaTela }) {
  const r = resumirTurno(turno);
  const real = turno.hora_inicio_real && turno.hora_fim_real;

  return (
    <section aria-labelledby="titulo-resumo" className="flex min-w-0 flex-col gap-4">
      <h2 id="titulo-resumo" className="text-lg font-semibold text-primaria">Resumo do turno</h2>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metrica
          rotulo="Cumprimento do dia"
          valor={formatarPercentual(r.cumprimento)}
          detalhe={[
            `${r.concluidas} de ${r.total} atividades concluídas`,
            r.avanco === null ? null : `avanço físico ${formatarPercentual(r.avanco)}`,
            textoForaDoDia(r),
          ]
            .filter(Boolean)
            .join(" · ")}
          explicacao={EXPLICA_CUMPRIMENTO}
        />
        <Metrica
          rotulo="Homens-hora"
          valor={r.hh === null ? "—" : numeroBR(r.hh)}
          detalhe={[
            real ? `Horário real ${horaCurta(turno.hora_inicio_real)} às ${horaCurta(turno.hora_fim_real)}` : "Horário previsto",
            r.hhParado ? `${numeroBR(r.hhParado)} HH parados` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
        <Metrica rotulo="Efetivo total" valor={String(r.efetivoTotal)} detalhe="pessoas" />
      </div>
      {r.avisosEfetivo.map((a) => (
        <Aviso key={a} tom="alerta">{`Efetivo: ${a}. Confira as movimentações.`}</Aviso>
      ))}

      <Cartao className="min-w-0">
        <h3 className="mb-2 font-semibold text-texto">Planejado × realizado</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="text-texto-suave">
              <tr>
                <th className="py-2 pr-3 font-medium">Atividade</th>
                <th className="py-2 pr-3 text-right font-medium">Planejado</th>
                <th className="py-2 pr-3 text-right font-medium">Realizado</th>
                <th className="py-2 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {r.atividades.map((a) => (
                <tr key={a.id}>
                  <td className="py-2 pr-3">
                    <p className="font-medium text-texto">{a.descricao}</p>
                    {a.local && <p className="text-xs text-texto-suave">{a.local}</p>}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 text-right">{qtdComUnidade(a.qtd_planejada, a.unidade)}</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-right">{a.qtd_realizada === null ? "—" : qtdComUnidade(a.qtd_realizada, a.unidade)}</td>
                  <td className="py-2"><Selo tom={TOM[a.status]}>{ROTULO_STATUS_ATIVIDADE[a.status]}</Selo></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>

      <div className="grid gap-3 md:grid-cols-2">
        <Cartao>
          <h3 className="mb-2 font-semibold text-texto">Restrições por causa</h3>
          {r.restricoesPorCausa.length === 0 ? (
            <p className="text-sm text-texto-suave">Nenhuma restrição registrada.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {r.restricoesPorCausa.map((c) => (
                <li key={c.causa}>
                  <p className="font-medium text-texto">{c.rotulo} <span className="text-texto-suave">({c.atividades.length})</span></p>
                  <ul className="list-disc pl-5 text-sm text-texto-suave">
                    {c.atividades.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao>
          <ClimaTurno
            clima={clima.clima}
            paradasClima={r.paradasClima}
            aviso={clima.aviso}
            parcial={clima.parcial}
            linkObra={`/obras/${turno.obra_id}#cidade`}
          />
          {!turno.clima_turno && clima.aviso === "indisponivel" && turno.status === "enviado" && <BuscarClima turnoId={turno.id} />}
          {!turno.clima_turno && clima.aviso === "indisponivel" && turno.status === "fechado" && (
            <p className="mt-1 text-sm text-texto-suave">Clima não registrado — reabra e feche o turno para buscar de novo.</p>
          )}
          <h3 className="mb-2 mt-4 font-semibold text-texto">Efetivo</h3>
          {turno.efetivo.length === 0 ? (
            <p className="text-sm text-texto-suave">Nenhum efetivo informado.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {turno.efetivo.map((e) => (
                <li key={e.id} className="flex justify-between gap-3">
                  <span className="text-texto">{e.funcao}</span>
                  <span className="text-texto-suave">{e.quantidade}</span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </section>
  );
}
