import type { SupabaseClient } from "@supabase/supabase-js";
import { falha, ok, type Resultado } from "./resultado";
import type { Janela } from "@/lib/dominio/efetivoHH";
import { normalizarWhatsapp } from "@/lib/dominio/whatsapp";
import { errosDeTamanho, falhaCampos, LIMITES, validarIntervalo } from "./validacao";

/** Limites de nome/cliente/endereço da obra, por campo. */
export function errosObra(d: { nome?: string; cliente?: string; endereco?: string }): Record<string, string> {
  return errosDeTamanho({
    nome: { valor: d.nome, max: LIMITES.obraNome },
    cliente: { valor: d.cliente, max: LIMITES.obraCliente },
    endereco: { valor: d.endereco, max: LIMITES.obraEndereco },
  });
}

export type Obra = {
  id: string;
  empresa_id: string;
  nome: string;
  cliente: string | null;
  endereco: string | null;
  created_at: string;
  /** WhatsApp do planejador (dígitos com DDI); ausente nas fotos do RDO. */
  whatsapp_planejador?: string | null;
  /** Cidade escolhida para o clima automático (ausentes em dados antigos). */
  local_nome?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

const COLUNAS = "id, empresa_id, nome, cliente, endereco, created_at, whatsapp_planejador, local_nome, latitude, longitude";

export async function listarObras(cliente: SupabaseClient): Promise<Obra[]> {
  const { data, error } = await cliente.from("obras").select(COLUNAS).order("nome");
  if (error) throw new Error(`listarObras: ${error.message}`);
  return (data ?? []) as Obra[];
}

export async function obterObra(cliente: SupabaseClient, id: string): Promise<Obra | null> {
  const { data, error } = await cliente.from("obras").select(COLUNAS).eq("id", id).maybeSingle();
  if (error) {
    if (error.code === "22P02") return null; // UUID inválido
    console.error("obterObra:", error.message);
    throw new Error(`obterObra: ${error.message}`);
  }
  return (data as Obra | null) ?? null;
}

export async function criarObra(
  cliente: SupabaseClient,
  dados: { nome: string; cliente?: string; endereco?: string },
): Promise<Resultado<Obra>> {
  const nome = dados.nome.trim();
  if (!nome) return falha("Informe o nome da obra");
  const tamanho = falhaCampos(errosObra(dados));
  if (tamanho) return tamanho;

  // MVP: cada usuário pertence a exatamente uma empresa.
  const { data: auth } = await cliente.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return falha("Sessão expirada. Entre novamente.");
  const { data: m, error: em } = await cliente
    .from("membros")
    .select("empresa_id")
    .eq("user_id", userId)
    .limit(1);
  if (em) {
    console.error("criarObra (membros):", em.message);
    return falha("Não foi possível criar a obra.");
  }
  if (!m || m.length === 0) return falha("Sua conta não está vinculada a uma empresa.");

  const { data, error } = await cliente
    .from("obras")
    .insert({
      empresa_id: m[0].empresa_id,
      nome,
      cliente: dados.cliente?.trim() || null,
      endereco: dados.endereco?.trim() || null,
    })
    .select(COLUNAS)
    .single();
  if (error || !data) {
    console.error("criarObra:", error?.message);
    return falha("Não foi possível criar a obra.");
  }
  return ok(data as Obra);
}

export type IntervalosObra = { diurno: Janela | null; noturno: Janela | null };

const janelaDe = (i: unknown, f: unknown): Janela | null =>
  typeof i === "string" && typeof f === "string" ? { inicio: i.slice(0, 5), fim: f.slice(0, 5) } : null;

/** Intervalo padrão de refeição da obra (copiado para cada turno novo). */
export async function obterIntervalosObra(c: SupabaseClient, obraId: string): Promise<IntervalosObra | null> {
  const { data, error } = await c
    .from("obras")
    .select("intervalo_diurno_inicio, intervalo_diurno_fim, intervalo_noturno_inicio, intervalo_noturno_fim")
    .eq("id", obraId)
    .maybeSingle();
  if (error) {
    if (error.code === "22P02") return null;
    console.error("obterIntervalosObra:", error.message);
    throw new Error(`obterIntervalosObra: ${error.message}`);
  }
  if (!data) return null;
  return {
    diurno: janelaDe(data.intervalo_diurno_inicio, data.intervalo_diurno_fim),
    noturno: janelaDe(data.intervalo_noturno_inicio, data.intervalo_noturno_fim),
  };
}

/** Só vale para turnos criados depois (cada turno guarda o seu). */
export async function editarIntervalosObra(c: SupabaseClient, obraId: string, d: IntervalosObra): Promise<Resultado> {
  const diurno = validarIntervalo(d.diurno, "diurno");
  if (!diurno.ok) return falha(`Diurno: ${diurno.erro}`);
  const noturno = validarIntervalo(d.noturno, "noturno");
  if (!noturno.ok) return falha(`Noturno: ${noturno.erro}`);
  const { data, error } = await c
    .from("obras")
    .update({
      intervalo_diurno_inicio: diurno.dados?.inicio ?? null,
      intervalo_diurno_fim: diurno.dados?.fim ?? null,
      intervalo_noturno_inicio: noturno.dados?.inicio ?? null,
      intervalo_noturno_fim: noturno.dados?.fim ?? null,
    })
    .eq("id", obraId)
    .select("id");
  if (error && error.code !== "22P02") {
    console.error("editarIntervalosObra:", error.message);
    return falha("Não foi possível salvar. Tente novamente.");
  }
  if (!data || data.length === 0) return falha("Obra não encontrada");
  return ok(undefined);
}

/** Número que recebe os avisos de parada pelo WhatsApp ("" = sem número). */
export async function editarWhatsappObra(c: SupabaseClient, obraId: string, entrada: string): Promise<Resultado> {
  const n = normalizarWhatsapp(entrada);
  if (!n.ok) return n;
  const { data, error } = await c.from("obras").update({ whatsapp_planejador: n.dados }).eq("id", obraId).select("id");
  if (error && error.code !== "22P02") {
    console.error("editarWhatsappObra:", error.message);
    return falha("Não foi possível salvar. Tente novamente.");
  }
  if (!data || data.length === 0) return falha("Obra não encontrada");
  return ok(undefined);
}
