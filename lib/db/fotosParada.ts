import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validarFoto } from "@/lib/dominio/foto";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { turnoAberto } from "./campo";
import { turnoAbertoParaCorrecao } from "./execucao";
import { ERRO_OCORRENCIA_INVALIDA } from "./mensagens";
import { falha, ok, type Resultado } from "./resultado";

/**
 * Fotos das paradas no bucket privado "paradas". Upload e leitura só pelo servidor (service role);
 * a tela recebe URLs assinadas de curta duração. Caminho: <empresa>/<obra>/<turno>/<ocorrência>.jpg.
 */

const BUCKET = "paradas";
const ERRO_GENERICO = "Não foi possível enviar a foto. Tente novamente.";
const VALIDADE_URL_S = 3600;

type Alvo = { turnoId: string; ocorrenciaId: string; responsavelId: string | null | undefined };

async function enviar(c: SupabaseClient, alvo: Alvo, form: FormData): Promise<Resultado> {
  const foto = form.get("foto");
  const arquivo = foto instanceof File ? foto : null;
  const v = validarFoto(arquivo);
  if (!v.ok) return v;

  const { data: o, error: eo } = await c
    .from("efetivo_ocorrencias")
    .select("tipo, responsavel_id, turno:turnos(obra_id, obra:obras(empresa_id))")
    .eq("id", alvo.ocorrenciaId)
    .eq("turno_id", alvo.turnoId)
    .maybeSingle();
  if (eo && eo.code !== "22P02") {
    console.error("enviarFoto:", eo.message);
    return falha(ERRO_GENERICO);
  }
  if (!o || o.tipo !== "parado") return falha(ERRO_OCORRENCIA_INVALIDA);
  if (alvo.responsavelId !== undefined && (o.responsavel_id ?? null) !== alvo.responsavelId) return falha(ERRO_OCORRENCIA_INVALIDA);
  const turno = o.turno as unknown as { obra_id: string; obra: { empresa_id: string } };
  const caminho = `${turno.obra.empresa_id}/${turno.obra_id}/${alvo.turnoId}/${alvo.ocorrenciaId}.jpg`;

  const admin = criarClienteAdmin();
  const up = await admin.storage.from(BUCKET).upload(caminho, arquivo!, { contentType: "image/jpeg", upsert: true });
  if (up.error) {
    console.error("enviarFoto (upload):", up.error.message);
    return falha(ERRO_GENERICO);
  }
  const { data, error } = await c.from("efetivo_ocorrencias").update({ foto_path: caminho }).eq("id", alvo.ocorrenciaId).select("id");
  if (error || !data || data.length === 0) {
    // Turno fechado no meio do caminho (gatilho) ou parada removida: nada de arquivo órfão.
    await removerFoto(caminho);
    if (error && !String(error.message).includes("turno_fechado")) console.error("enviarFoto (gravar):", error.message);
    return falha(error && String(error.message).includes("turno_fechado") ? "Turno fechado: a foto não foi salva." : ERRO_GENERICO);
  }
  return ok(undefined);
}

export async function enviarFotoParadaCampo(token: string, ocorrenciaId: string, responsavelId: string | null, form: FormData): Promise<Resultado> {
  const t = await turnoAberto(token);
  if (!t.ok) return t;
  return enviar(criarClienteAdmin(), { turnoId: t.dados.id, ocorrenciaId, responsavelId }, form);
}

export async function enviarFotoParadaPlanejador(c: SupabaseClient, turnoId: string, ocorrenciaId: string, form: FormData): Promise<Resultado> {
  const t = await turnoAbertoParaCorrecao(c, turnoId);
  if (!t.ok) return t;
  return enviar(c, { turnoId, ocorrenciaId, responsavelId: undefined }, form);
}

/** Melhor esforço: só registra o erro. */
export async function removerFoto(caminho: string): Promise<void> {
  const { error } = await criarClienteAdmin().storage.from(BUCKET).remove([caminho]);
  if (error) console.error("removerFoto:", error.message);
}

/** URLs assinadas (1 h) por caminho; caminho sem URL fica de fora. */
export async function urlsFotos(caminhos: string[]): Promise<Record<string, string>> {
  const unicos = [...new Set(caminhos.filter(Boolean))];
  if (unicos.length === 0) return {};
  const { data, error } = await criarClienteAdmin().storage.from(BUCKET).createSignedUrls(unicos, VALIDADE_URL_S);
  if (error) {
    console.error("urlsFotos:", error.message);
    return {};
  }
  const r: Record<string, string> = {};
  for (const x of data ?? []) if (x.path && x.signedUrl) r[x.path] = x.signedUrl;
  return r;
}

/** Bytes das fotos para o PDF do RDO; foto que falhar fica de fora. */
export async function bytesFotos(caminhos: string[]): Promise<Record<string, Uint8Array>> {
  const r: Record<string, Uint8Array> = {};
  const admin = criarClienteAdmin();
  await Promise.all(
    [...new Set(caminhos.filter(Boolean))].map(async (p) => {
      const { data, error } = await admin.storage.from(BUCKET).download(p);
      if (error || !data) {
        console.error("bytesFotos:", error?.message);
        return;
      }
      r[p] = new Uint8Array(await data.arrayBuffer());
    }),
  );
  return r;
}
