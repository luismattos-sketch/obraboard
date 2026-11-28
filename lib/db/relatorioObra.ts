import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lerIniciados, lerOcorrencias, lerTerminados } from "@/lib/dominio/efetivoHH";
import { lerMateriais } from "@/lib/dominio/extraApontamento";
import type { AtividadeRelatorio, TurnoRelatorio } from "@/lib/dominio/relatorioObra";
import type { TipoAtividade } from "@/lib/dominio/tipos";

/** Item 4.4: turnos FECHADOS da obra no período, com o que o Relatório da Obra precisa (cliente da sessão, RLS). */
export async function turnosDoRelatorio(c: SupabaseClient, obraId: string, de: string, ate: string): Promise<TurnoRelatorio[]> {
  const { data, error } = await c
    .from("turnos")
    .select(
      "id, data, periodo, hora_inicio_prevista, hora_fim_prevista, hora_inicio_real, hora_fim_real, intervalo_inicio, intervalo_fim, " +
        "atividades(id, descricao, local, unidade, qtd_planejada, qtd_realizada, tipo, responsavel_id, solicitado_por, extra_pessoas, extra_horas, materiais, foto_path, ciencias_extra(nome, ciente_em)), " +
        "efetivo(funcao, quantidade, responsavel_id), efetivo_ocorrencias(*), " +
        "turno_equipes_terminadas(responsavel_id, terminou_em), turno_equipes_iniciadas(responsavel_id, iniciou_em)",
    )
    .eq("obra_id", obraId)
    .eq("status", "fechado")
    .gte("data", de)
    .lte("data", ate);
  if (error) {
    console.error("turnosDoRelatorio:", error.message);
    throw new Error(`turnosDoRelatorio: ${error.message}`);
  }
  type Linha = Record<string, unknown> & {
    atividades: Record<string, unknown>[] | null;
    efetivo: { funcao: string; quantidade: number; responsavel_id: string | null }[] | null;
  };
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return ((data ?? []) as unknown as Linha[]).map((t) => ({
    id: t.id as string,
    data: t.data as string,
    periodo: t.periodo as TurnoRelatorio["periodo"],
    hora_inicio_prevista: (t.hora_inicio_prevista as string | null) ?? null,
    hora_fim_prevista: (t.hora_fim_prevista as string | null) ?? null,
    hora_inicio_real: (t.hora_inicio_real as string | null) ?? null,
    hora_fim_real: (t.hora_fim_real as string | null) ?? null,
    intervalo_inicio: (t.intervalo_inicio as string | null) ?? null,
    intervalo_fim: (t.intervalo_fim as string | null) ?? null,
    efetivo: (t.efetivo ?? []).map((e) => ({ funcao: e.funcao, quantidade: Number(e.quantidade), responsavel_id: e.responsavel_id ?? null })),
    ocorrencias: lerOcorrencias(t.efetivo_ocorrencias),
    terminados: lerTerminados(t.turno_equipes_terminadas),
    iniciados: lerIniciados(t.turno_equipes_iniciadas),
    atividades: (t.atividades ?? []).map((a): AtividadeRelatorio => {
      const ci = a.ciencias_extra as { nome: string; ciente_em: string } | { nome: string; ciente_em: string }[] | null;
      return {
        id: a.id as string,
        descricao: a.descricao as string,
        local: (a.local as string | null) ?? null,
        unidade: (a.unidade as string | null) ?? "",
        qtd_planejada: Number(a.qtd_planejada),
        qtd_realizada: num(a.qtd_realizada),
        tipo: (a.tipo as TipoAtividade | null) ?? null,
        responsavel_id: (a.responsavel_id as string | null) ?? null,
        solicitado_por: (a.solicitado_por as string | null) ?? null,
        extra_pessoas: num(a.extra_pessoas),
        extra_horas: num(a.extra_horas),
        materiais: lerMateriais(a.materiais),
        foto_path: (a.foto_path as string | null) ?? null,
        ciencia: Array.isArray(ci) ? (ci[0] ?? null) : (ci ?? null),
      };
    }),
  }));
}
