import type { SupabaseClient } from "@supabase/supabase-js";
import { percentualCumprimento } from "@/lib/dominio/calculos";
import { lerEmPaginas, type ItemVersao } from "@/lib/dominio/historico-rdo";
import type { Periodo, StatusTurno } from "@/lib/dominio/tipos";
import type { VersaoRdo } from "@/lib/rdo/versao";

const UUID_INVALIDO = "22P02";
/** Linhas por pedido (o limite padrão da API do Supabase é 1000). */
const PAGINA = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LinhaLista = {
  id: string;
  turno_id: string;
  obra_id: string;
  numero: number;
  emitido_em: string;
  retroativa: boolean;
  data: string;
  periodo: Periodo;
  obra_nome: string;
  atividades: { qtd_planejada: number | string; qtd_realizada: number | string | null }[] | null;
  turno: { status: StatusTurno } | null;
};

/** Versões oficiais visíveis ao usuário (RLS), com o necessário para as listas. */
export async function listarVersoes(c: SupabaseClient, filtro: { obraId?: string }): Promise<ItemVersao[]> {
  if (filtro.obraId !== undefined && !UUID.test(filtro.obraId)) return [];
  const linhas = await lerEmPaginas<LinhaLista>(async (de, ate) => {
    let q = c
      .from("rdo_versoes")
      .select(
        "id, turno_id, obra_id, numero, emitido_em, retroativa, data:dados->turno->>data, periodo:dados->turno->>periodo, obra_nome:dados->obra->>nome, atividades:dados->atividades, turno:turnos(status)",
      )
      .order("emitido_em", { ascending: false })
      .order("id")
      .range(de, ate);
    if (filtro.obraId) q = q.eq("obra_id", filtro.obraId);
    const { data, error } = await q;
    if (error) {
      console.error("listarVersoes:", error.message);
      throw new Error(`listarVersoes: ${error.message}`);
    }
    return (data ?? []) as unknown as LinhaLista[];
  }, PAGINA);
  return linhas.map((l) => ({
    id: l.id,
    turnoId: l.turno_id,
    obraId: l.obra_id,
    obraNome: l.obra_nome,
    numero: l.numero,
    emitidoEm: l.emitido_em,
    retroativa: l.retroativa,
    data: l.data,
    periodo: l.periodo,
    turnoStatus: l.turno?.status ?? "fechado",
    percentual: percentualCumprimento(
      (l.atividades ?? []).map((a) => ({
        qtd_planejada: Number(a.qtd_planejada),
        qtd_realizada: a.qtd_realizada === null ? null : Number(a.qtd_realizada),
      })),
    ),
  }));
}

/** Uma versão com a foto; `null` se não existe, não é visível ou o id é inválido. */
export async function obterVersao(c: SupabaseClient, id: string): Promise<VersaoRdo | null> {
  const { data, error } = await c
    .from("rdo_versoes")
    .select("id, turno_id, obra_id, numero, emitido_em, retroativa, formato, dados")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (error.code === UUID_INVALIDO) return null;
    console.error("obterVersao:", error.message);
    throw new Error(`obterVersao: ${error.message}`);
  }
  return (data as VersaoRdo | null) ?? null;
}

/** Várias versões com a foto, numa consulta só (ids inválidos ou invisíveis ficam de fora). */
export async function obterVersoes(c: SupabaseClient, ids: string[]): Promise<VersaoRdo[]> {
  const validos = ids.filter((id) => UUID.test(id));
  if (validos.length === 0) return [];
  const { data, error } = await c
    .from("rdo_versoes")
    .select("id, turno_id, obra_id, numero, emitido_em, retroativa, formato, dados")
    .in("id", validos);
  if (error) {
    console.error("obterVersoes:", error.message);
    throw new Error(`obterVersoes: ${error.message}`);
  }
  return (data ?? []) as VersaoRdo[];
}

/** Versões de um turno, v1 primeiro (sem a foto). */
export async function versoesDoTurno(
  c: SupabaseClient,
  turnoId: string,
): Promise<{ id: string; numero: number; emitido_em: string }[]> {
  const { data, error } = await c
    .from("rdo_versoes")
    .select("id, numero, emitido_em")
    .eq("turno_id", turnoId)
    .order("numero");
  if (error) {
    if (error.code === UUID_INVALIDO) return [];
    console.error("versoesDoTurno:", error.message);
    throw new Error(`versoesDoTurno: ${error.message}`);
  }
  return (data ?? []) as { id: string; numero: number; emitido_em: string }[];
}
