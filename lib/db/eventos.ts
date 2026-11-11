import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventoTurno } from "@/lib/dominio/eventos";

const UUID_INVALIDO = "22P02";

type Linha = {
  id: string;
  tipo: EventoTurno["tipo"];
  em: string;
  ator_tipo: EventoTurno["atorTipo"];
  ator_nome: string | null;
  versao: number | null;
  motivo: string | null;
};

/** Marcos do turno visíveis ao usuário (RLS), do mais antigo para o mais recente. */
export async function listarEventos(c: SupabaseClient, turnoId: string): Promise<EventoTurno[]> {
  const { data, error } = await c
    .from("turno_eventos")
    .select("id, tipo, em, ator_tipo, ator_nome, versao, motivo")
    .eq("turno_id", turnoId)
    .order("em")
    .order("id");
  if (error) {
    if (error.code === UUID_INVALIDO) return [];
    console.error("listarEventos:", error.message);
    throw new Error(`listarEventos: ${error.message}`);
  }
  return ((data ?? []) as Linha[]).map((l) => ({
    id: l.id,
    tipo: l.tipo,
    em: l.em,
    atorTipo: l.ator_tipo,
    atorNome: l.ator_nome,
    versao: l.versao,
    motivo: l.motivo,
  }));
}
