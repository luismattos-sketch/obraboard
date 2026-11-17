import type { Atividade } from "@/lib/db/atividades";
import type { TurnoCompleto } from "@/lib/db/turnos";
import { percentualCumprimento, statusAtividade } from "./calculos";
import { calcularHH, intervaloDoTurno, janelaDoTurno, type HHEquipe } from "./efetivoHH";
import { CAUSAS, type Causa, type StatusAtividade } from "./tipos";

export type ResumoTurno = {
  cumprimento: number | null;
  /** HH total (produtivo + parado). */
  hh: number | null;
  hhParado: number | null;
  hhParadoPorCausa: Partial<Record<Causa, number>>;
  /** Pessoas contadas uma vez (na equipe de origem). */
  efetivoTotal: number;
  hhEquipes: HHEquipe[];
  avisosEfetivo: string[];
  atividades: (Atividade & { status: StatusAtividade })[];
  restricoesPorCausa: { causa: Causa; rotulo: string; atividades: string[] }[];
  climaImpediu: boolean;
  /** Fora do cumprimento do dia. */
  extras: number;
  adiantadas: number;
  /** Atividades do dia (sem extra/adiantada): concluídas e total. */
  concluidas: number;
  total: number;
};

/** "+1 extra · +2 adiantadas" (vazio quando não há). */
export function textoForaDoDia(r: Pick<ResumoTurno, "extras" | "adiantadas">): string {
  return [
    r.extras > 0 ? `+${r.extras} extra${r.extras > 1 ? "s" : ""}` : null,
    r.adiantadas > 0 ? `+${r.adiantadas} adiantada${r.adiantadas > 1 ? "s" : ""}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Resumo puro do turno (consumido pela tela do planejador e pelo RDO em PDF). */
export function resumirTurno(t: TurnoCompleto): ResumoTurno {
  const atividades = t.atividades.map((a) => ({ ...a, status: statusAtividade(a.qtd_planejada, a.qtd_realizada) }));

  const porCausa = new Map<Causa, string[]>();
  for (const a of atividades) {
    if (a.tipo || a.status === "concluida" || !a.causa) continue;
    porCausa.set(a.causa, [...(porCausa.get(a.causa) ?? []), a.descricao]);
  }
  const restricoesPorCausa = [...porCausa.entries()]
    .map(([causa, descricoes]) => ({ causa, rotulo: CAUSAS[causa], atividades: descricoes }))
    .sort((x, y) => y.atividades.length - x.atividades.length); // sort estável: empate mantém a ordem de aparição

  const hh = calcularHH({
    efetivo: t.efetivo.map((e) => ({ funcao: e.funcao, quantidade: e.quantidade, responsavel_id: e.responsavel_id ?? null })),
    ocorrencias: t.ocorrencias ?? [],
    janela: janelaDoTurno(t),
    intervalo: intervaloDoTurno(t),
  });

  return {
    cumprimento: percentualCumprimento(t.atividades),
    hh: hh.hh,
    hhParado: hh.hhParado,
    hhParadoPorCausa: hh.hhParadoPorCausa,
    efetivoTotal: hh.pessoas,
    hhEquipes: hh.equipes,
    avisosEfetivo: hh.avisos,
    atividades,
    restricoesPorCausa,
    climaImpediu: t.clima.some((c) => c.impediu),
    extras: t.atividades.filter((a) => a.tipo === "extra").length,
    adiantadas: t.atividades.filter((a) => a.tipo === "adiantada").length,
    concluidas: atividades.filter((a) => !a.tipo && a.status === "concluida").length,
    total: atividades.filter((a) => !a.tipo).length,
  };
}
