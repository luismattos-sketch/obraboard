import type { Atividade } from "@/lib/db/atividades";
import type { TurnoCompleto } from "@/lib/db/turnos";
import { hhTurno, percentualCumprimento, statusAtividade } from "./calculos";
import { CAUSAS, type Causa, type StatusAtividade } from "./tipos";

export type ResumoTurno = {
  cumprimento: number | null;
  hh: number | null;
  efetivoTotal: number;
  atividades: (Atividade & { status: StatusAtividade })[];
  restricoesPorCausa: { causa: Causa; rotulo: string; atividades: string[] }[];
  climaImpediu: boolean;
};

/** Resumo puro do turno (consumido pela tela do planejador e pelo RDO em PDF). */
export function resumirTurno(t: TurnoCompleto): ResumoTurno {
  const atividades = t.atividades.map((a) => ({ ...a, status: statusAtividade(a.qtd_planejada, a.qtd_realizada) }));

  const porCausa = new Map<Causa, string[]>();
  for (const a of atividades) {
    if (a.status === "concluida" || !a.causa) continue;
    porCausa.set(a.causa, [...(porCausa.get(a.causa) ?? []), a.descricao]);
  }
  const restricoesPorCausa = [...porCausa.entries()]
    .map(([causa, descricoes]) => ({ causa, rotulo: CAUSAS[causa], atividades: descricoes }))
    .sort((x, y) => y.atividades.length - x.atividades.length); // sort estável: empate mantém a ordem de aparição

  return {
    cumprimento: percentualCumprimento(t.atividades),
    hh: hhTurno(
      t.efetivo,
      { inicio: t.hora_inicio_prevista, fim: t.hora_fim_prevista },
      { inicio: t.hora_inicio_real, fim: t.hora_fim_real },
    ),
    efetivoTotal: t.efetivo.reduce((s, e) => s + e.quantidade, 0),
    atividades,
    restricoesPorCausa,
    climaImpediu: t.clima.some((c) => c.impediu),
  };
}
