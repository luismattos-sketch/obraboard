import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lerMateriais } from "@/lib/dominio/extraApontamento";
import { agruparPorSemana, validarNomeCiencia, type ExtraCiencia, type SemanaCiencia } from "@/lib/dominio/ciencia";
import { somarDias } from "@/lib/dominio/programacao";
import { gerarToken, hashToken } from "@/lib/dominio/token";
import type { Periodo } from "@/lib/dominio/tipos";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { falha, ok, type Resultado } from "./resultado";

/**
 * Item 4.3: link semanal de ciência dos serviços extras. O planejador usa o cliente da sessão (RLS);
 * o link público usa o admin SEMPRE depois de resolver o link pelo código (linkPorCodigo).
 */

const CODIGO_FORMATO = /^[A-Za-z0-9_-]{43}$/;
const SEGUNDA = /^\d{4}-\d{2}-\d{2}$/;
export const ERRO_LINK_CIENCIA = "Link desativado. Peça o link novo ao planejador.";

type LinhaExtra = {
  id: string;
  descricao: string;
  local: string | null;
  qtd_realizada: number | null;
  unidade: string | null;
  responsavel_id: string | null;
  solicitado_por: string | null;
  extra_pessoas: number | null;
  extra_horas: number | null;
  materiais: unknown;
  observacao: string | null;
  foto_path: string | null;
  ciencias_extra: { nome: string; ciente_em: string } | { nome: string; ciente_em: string }[] | null;
};
type LinhaTurno = { data: string; periodo: Periodo; atividades: LinhaExtra[] | null };

const primeira = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));

async function lerExtras(c: SupabaseClient, obraId: string, desde: string, ate?: string): Promise<{ turnos: LinhaTurno[]; nomes: Map<string, string> }> {
  let q = c
    .from("turnos")
    .select(
      "data, periodo, atividades!inner(id, descricao, local, qtd_realizada, unidade, responsavel_id, solicitado_por, extra_pessoas, extra_horas, materiais, observacao, foto_path, tipo, ciencias_extra(nome, ciente_em))",
    )
    .eq("obra_id", obraId)
    .eq("atividades.tipo", "extra")
    .gte("data", desde);
  if (ate) q = q.lte("data", ate);
  const [{ data, error }, resp] = await Promise.all([q, c.from("responsaveis").select("id, nome").eq("obra_id", obraId)]);
  if (error || resp.error) {
    const m = (error ?? resp.error)!.message;
    console.error("ciencia (extras):", m);
    throw new Error(`ciencia: ${m}`);
  }
  return {
    turnos: (data ?? []) as unknown as LinhaTurno[],
    nomes: new Map(((resp.data ?? []) as { id: string; nome: string }[]).map((r) => [r.id, r.nome])),
  };
}

/** Planejador: semanas com serviço extra (últimas 12), com contagem de ciências e o link de cada uma. */
export async function semanasDeCiencia(c: SupabaseClient, obraId: string, hoje: string): Promise<SemanaCiencia[]> {
  const desde = somarDias(hoje, -7 * 12);
  const [{ turnos }, links] = await Promise.all([
    lerExtras(c, obraId, desde),
    c.from("links_ciencia").select("semana, codigo").eq("obra_id", obraId),
  ]);
  if (links.error) {
    console.error("semanasDeCiencia (links):", links.error.message);
    throw new Error(`semanasDeCiencia: ${links.error.message}`);
  }
  const extras = turnos.flatMap((t) => (t.atividades ?? []).map((a) => ({ data: t.data, ciente: primeira(a.ciencias_extra) !== null })));
  return agruparPorSemana(extras, (links.data ?? []) as { semana: string; codigo: string }[]);
}

/** Gera (ou troca) o link da semana. O link anterior da mesma semana deixa de funcionar. */
export async function gerarLinkCiencia(c: SupabaseClient, obraId: string, semana: string): Promise<Resultado<{ codigo: string }>> {
  if (!SEGUNDA.test(semana) || new Date(`${semana}T12:00:00Z`).getUTCDay() !== 1) return falha("Semana inválida");
  const codigo = gerarToken();
  const { error } = await c
    .from("links_ciencia")
    .upsert({ obra_id: obraId, semana, codigo, codigo_hash: hashToken(codigo), created_at: new Date().toISOString() }, { onConflict: "obra_id,semana" });
  if (error) {
    console.error("gerarLinkCiencia:", error.message);
    return falha("Não foi possível gerar o link.");
  }
  return ok({ codigo });
}

export type LinkCiencia = { id: string; obraId: string; obraNome: string; cliente: string | null; semana: string };

export async function linkPorCodigo(codigo: string): Promise<LinkCiencia | null> {
  if (typeof codigo !== "string" || !CODIGO_FORMATO.test(codigo)) return null;
  const { data, error } = await criarClienteAdmin()
    .from("links_ciencia")
    .select("id, obra_id, semana, obras(nome, cliente)")
    .eq("codigo_hash", hashToken(codigo))
    .maybeSingle();
  if (error) {
    console.error("linkPorCodigo:", error.message);
    throw new Error("linkPorCodigo");
  }
  if (!data) return null;
  const d = data as unknown as { id: string; obra_id: string; semana: string; obras: { nome: string; cliente: string | null } | { nome: string; cliente: string | null }[] };
  const obra = primeira(d.obras);
  return { id: d.id, obraId: d.obra_id, obraNome: obra?.nome ?? "", cliente: obra?.cliente ?? null, semana: d.semana };
}

/** Extras da semana do link (admin, filtrado pela obra e pela semana do link). */
export async function extrasDoLink(link: LinkCiencia): Promise<ExtraCiencia[]> {
  const { turnos, nomes } = await lerExtras(criarClienteAdmin(), link.obraId, link.semana, somarDias(link.semana, 6));
  return turnos
    .flatMap((t) =>
      (t.atividades ?? []).map((a) => ({
        id: a.id,
        data: t.data,
        periodo: t.periodo,
        descricao: a.descricao,
        local: a.local,
        qtd: Number(a.qtd_realizada ?? 0),
        unidade: a.unidade ?? "",
        responsavel: a.responsavel_id ? (nomes.get(a.responsavel_id) ?? null) : null,
        solicitado_por: a.solicitado_por,
        extra_pessoas: a.extra_pessoas === null ? null : Number(a.extra_pessoas),
        extra_horas: a.extra_horas === null ? null : Number(a.extra_horas),
        materiais: lerMateriais(a.materiais),
        observacao: a.observacao,
        foto_path: a.foto_path,
        ciencia: primeira(a.ciencias_extra),
      })),
    )
    .sort((x, y) => x.data.localeCompare(y.data) || x.periodo.localeCompare(y.periodo));
}

/** Registra a ciência nos extras escolhidos que ainda não têm. Repetir não duplica nem troca o nome. */
export async function registrarCiencia(codigo: string, ids: unknown, nome: unknown): Promise<Resultado<{ registradas: number }>> {
  const v = validarNomeCiencia(nome);
  if (!v.ok) return falha(v.erro, { nome: v.erro });
  const link = await linkPorCodigo(codigo);
  if (!link) return falha(ERRO_LINK_CIENCIA);
  const pedidos = new Set(Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : []);
  const extras = await extrasDoLink(link);
  const alvos = extras.filter((e) => pedidos.has(e.id) && !e.ciencia);
  if (alvos.length === 0) return ok({ registradas: 0 });
  const { error } = await criarClienteAdmin()
    .from("ciencias_extra")
    .upsert(alvos.map((e) => ({ atividade_id: e.id, link_id: link.id, nome: v.nome })), { onConflict: "atividade_id", ignoreDuplicates: true });
  if (error) {
    console.error("registrarCiencia:", error.message);
    return falha("Não foi possível registrar. Tente novamente.");
  }
  return ok({ registradas: alvos.length });
}

/** Extra com ciência do cliente não pode ser removido. */
export async function temCiencia(c: SupabaseClient, atividadeId: string): Promise<boolean> {
  const { data } = await c.from("ciencias_extra").select("atividade_id").eq("atividade_id", atividadeId).maybeSingle();
  return !!data;
}
