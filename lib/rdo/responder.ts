import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bytesFotos } from "@/lib/db/fotosParada";
import { obterVersao, versoesDoTurno } from "@/lib/db/rdo-versoes";
import type { TurnoCompleto } from "@/lib/db/turnos";
import { resumirTurno } from "@/lib/dominio/resumo";
import { DocumentoRdo } from "./documento";
import { nomeArquivoRdo } from "./nome-arquivo";
import { emissaoDaVersao, lerFoto, type Emissao } from "./versao";

export const ERRO_GERAR_RDO = "Não foi possível gerar o RDO";

/** O PDF de um RDO. Download individual e lote passam por aqui (saem idênticos). */
export async function renderizarRdo(turno: TurnoCompleto, emissao: Emissao, fotos?: Record<string, Uint8Array>): Promise<Buffer> {
  return renderToBuffer(
    createElement(DocumentoRdo, { turno, resumo: resumirTurno(turno), emissao, fotos }) as ReactElement<DocumentProps>,
  );
}

/** PDF do RDO como anexo para download. */
export async function respostaPdf(turno: TurnoCompleto, emissao: Emissao, nomeArquivo: string): Promise<Response> {
  // Download individual leva as fotos das paradas (o lote não: limite de resposta do Vercel).
  const fotos = await bytesFotos(turno.ocorrencias.map((o) => o.foto_path ?? ""));
  const pdf = await renderizarRdo(turno, emissao, fotos);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** PDF de uma versão oficial, montado a partir da foto guardada. */
export async function respostaVersao(c: SupabaseClient, versaoId: string): Promise<Response> {
  const v = await obterVersao(c, versaoId);
  if (!v) return Response.json({ erro: "RDO não encontrado" }, { status: 404 });
  try {
    const turno = lerFoto(v);
    const anterior = v.numero > 1 ? (await versoesDoTurno(c, v.turno_id)).find((x) => x.numero === v.numero - 1) : undefined;
    return await respostaPdf(
      turno,
      emissaoDaVersao(v, anterior),
      nomeArquivoRdo(turno.obra.nome, turno.data, turno.periodo, { versao: v.numero }),
    );
  } catch (e) {
    console.error("respostaVersao:", e instanceof Error ? e.message : e);
    return Response.json({ erro: ERRO_GERAR_RDO }, { status: 500 });
  }
}
