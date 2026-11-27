import {
  calcularHH,
  intervaloDoTurno,
  janelaDoTurno,
  type Iniciado,
  type Ocorrencia,
  type Terminado,
} from "./efetivoHH";
import { CAUSAS, GRUPO_CAUSA, type Causa, type Periodo } from "./tipos";

/**
 * Item 3.5: HH perdido em paradas no período, somado por causa, por grupo (externa × interna) e por equipe.
 * Usa a mesma regra do resumo do turno e do RDO (calcularHH), turno fechado a turno fechado.
 */

export type TurnoHH = {
  id: string;
  data: string;
  periodo: Periodo;
  hora_inicio_prevista: string | null;
  hora_fim_prevista: string | null;
  hora_inicio_real: string | null;
  hora_fim_real: string | null;
  intervalo_inicio: string | null;
  intervalo_fim: string | null;
  efetivo: { funcao: string; quantidade: number; responsavel_id: string | null }[];
  ocorrencias: Ocorrencia[];
  iniciados: Iniciado[];
  terminados: Terminado[];
};

export type GrupoHH = "externa" | "interna" | "outra";
export type CausaHH = { causa: Causa; rotulo: string; grupo: GrupoHH; hh: number; fracao: number };
export type EquipeHH = { responsavelId: string | null; nome: string; hh: number; fracao: number; causas: CausaHH[] };
export type HHPerdido = {
  total: number;
  /** Turnos fechados com alguma hora parada. */
  turnos: number;
  grupos: { grupo: GrupoHH; hh: number; fracao: number }[];
  causas: CausaHH[];
  equipes: EquipeHH[];
};

const grupoDe = (c: Causa): GrupoHH => GRUPO_CAUSA[c] ?? "outra";

function listaDeCausas(m: Map<Causa, number>, total: number): CausaHH[] {
  return [...m]
    .filter(([, hh]) => hh > 0)
    .map(([causa, hh]) => ({ causa, rotulo: CAUSAS[causa], grupo: grupoDe(causa), hh, fracao: total > 0 ? hh / total : 0 }))
    .sort((a, b) => b.hh - a.hh);
}

export function hhPerdidoDaObra(turnos: TurnoHH[], responsaveis: { id: string; nome: string }[]): HHPerdido {
  const nomes = new Map(responsaveis.map((r) => [r.id, r.nome]));
  const porCausa = new Map<Causa, number>();
  const porEquipe = new Map<string | null, Map<Causa, number>>();
  let comParada = 0;

  for (const t of turnos) {
    if (!t.ocorrencias.some((o) => o.tipo === "parado")) continue;
    const r = calcularHH({
      efetivo: t.efetivo,
      ocorrencias: t.ocorrencias,
      janela: janelaDoTurno(t),
      intervalo: intervaloDoTurno(t),
      iniciados: t.iniciados,
      terminados: t.terminados,
    });
    if (!r.hhParado) continue;
    comParada++;
    for (const eq of r.equipes) {
      for (const [c, hh] of Object.entries(eq.hhParadoPorCausa) as [Causa, number][]) {
        if (!hh) continue;
        porCausa.set(c, (porCausa.get(c) ?? 0) + hh);
        const m = porEquipe.get(eq.responsavel_id) ?? new Map<Causa, number>();
        m.set(c, (m.get(c) ?? 0) + hh);
        porEquipe.set(eq.responsavel_id, m);
      }
    }
  }

  const total = [...porCausa.values()].reduce((s, x) => s + x, 0);
  const causas = listaDeCausas(porCausa, total);
  const grupos = (["externa", "interna", "outra"] as const)
    .map((grupo) => {
      const hh = causas.filter((c) => c.grupo === grupo).reduce((s, c) => s + c.hh, 0);
      return { grupo, hh, fracao: total > 0 ? hh / total : 0 };
    })
    .filter((g) => g.hh > 0);
  const equipes = [...porEquipe]
    .map(([id, m]) => {
      const hh = [...m.values()].reduce((s, x) => s + x, 0);
      return {
        responsavelId: id,
        nome: (id && nomes.get(id)) || "Sem equipe",
        hh,
        fracao: total > 0 ? hh / total : 0,
        causas: listaDeCausas(m, hh),
      };
    })
    .filter((e) => e.hh > 0)
    .sort((a, b) => b.hh - a.hh || a.nome.localeCompare(b.nome, "pt-BR"));

  return { total, turnos: comParada, grupos, causas, equipes };
}
