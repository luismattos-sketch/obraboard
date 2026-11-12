import type { ReactNode } from "react";
import { Selo } from "@/components/ui/Selo";
import { numeroBR, ROTULO_PERIODO } from "@/lib/dominio/formato";
import {
  gradeSemana,
  resumoEquipe,
  ROTULO_DIAS,
  ROTULO_SITUACAO,
  TOM_SITUACAO,
  type AtividadeResumida,
  type DiaSemana,
  type Situacao,
} from "@/lib/dominio/programacao";
import { CAUSAS, type Periodo } from "@/lib/dominio/tipos";

const COR_BARRA: Record<Situacao, string> = {
  cumprida: "bg-sucesso",
  em_andamento: "bg-alerta",
  sem_execucao: "bg-texto-suave/40",
};
const ICONE: Record<Periodo, string> = { diurno: "☀", noturno: "☾" };

/** Linha de grade: coluna estreita do período + uma coluna por dia. */
function Linha({ colunas, rotulo, children }: { colunas: number; rotulo: ReactNode; children: ReactNode }) {
  return (
    <div className="grid items-center" style={{ gridTemplateColumns: `1.5rem repeat(${colunas}, minmax(0, 1fr))` }}>
      <span className="text-center text-xs text-texto-suave">{rotulo}</span>
      {children}
    </div>
  );
}

export function GradeSemana({ atividades, encerrada }: { atividades: AtividadeResumida[]; encerrada: boolean }) {
  const grade = gradeSemana(atividades);
  const n = grade.dias.length;
  const marcado = (a: AtividadeResumida, d: DiaSemana | undefined) => d !== undefined && a.dias.includes(d);

  return (
    <div className="flex flex-col gap-1">
      <Linha colunas={n} rotulo="">
        {grade.dias.map((d) => (
          <span key={d} className="text-center text-xs font-semibold text-texto-suave">{ROTULO_DIAS[d]}</span>
        ))}
      </Linha>

      <ul className="divide-y divide-borda">
        {atividades.map((a) => {
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
              <p className="text-sm text-texto-suave">{resumoEquipe(a.equipe)}</p>
              {encerrada && a.causa && <p className="text-sm text-texto-suave">Causa: {CAUSAS[a.causa]}</p>}
              <div className="mt-1 flex flex-col gap-0.5">
                {grade.periodos.map((p) => (
                  <Linha key={p} colunas={n} rotulo={<span title={ROTULO_PERIODO[p]}>{ICONE[p]}</span>}>
                    {grade.dias.map((d, i) => {
                      const ativo = a.periodo === p && marcado(a, d);
                      if (!ativo) return <span key={d} className="h-3" />;
                      // Dias seguidos formam uma barra contínua: arredonda só as pontas.
                      const ini = !marcado(a, grade.dias[i - 1]);
                      const fim = !marcado(a, grade.dias[i + 1]);
                      return (
                        <span
                          key={d}
                          role="img"
                          aria-label={`${ROTULO_DIAS[d]} ${ROTULO_PERIODO[p]}`}
                          title={`${ROTULO_DIAS[d]} · ${ROTULO_PERIODO[p]}`}
                          className={`h-3 ${COR_BARRA[a.situacao]} ${ini ? "ml-0.5 rounded-l-full" : ""} ${fim ? "mr-0.5 rounded-r-full" : ""}`}
                        />
                      );
                    })}
                  </Linha>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-1 border-t-2 border-borda pt-3">
        <p className="text-sm font-semibold text-texto">Efetivo previsto</p>
        <Linha colunas={n} rotulo="">
          {grade.dias.map((d) => (
            <span key={d} className="text-center text-xs font-semibold text-texto-suave">{ROTULO_DIAS[d]}</span>
          ))}
        </Linha>
        {grade.periodos.map((p) => (
          <Linha key={p} colunas={n} rotulo={<span title={ROTULO_PERIODO[p]}>{ICONE[p]}</span>}>
            {grade.totais[p].map((t, i) => (
              <span key={grade.dias[i]} className="text-center text-sm text-texto">{t === 0 ? "–" : t}</span>
            ))}
          </Linha>
        ))}
      </div>
    </div>
  );
}
