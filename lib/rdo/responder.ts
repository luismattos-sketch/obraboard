import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bytesFotos } from "@/lib/db/fotosParada";
import { obterVersao, versoesDoTurno } from "@/lib/db/rdo-versoes";
import type { TurnoCompleto } from "@/lib/db/turnos";
import { resumirTurno } from "@/lib/dominio/resumo";
import { DocumentoRdo } from "./documento";
import { nomeArquivoRdo } from "./nome-arquivo";
import { obterNomeEmpresa } from "@/lib/db/empresas";
import { emissaoDaVersao, lerFoto, type Emissao } from "./versao";

export const ERRO_GERAR_RDO = "Não foi possível gerar o RDO";

/** O PDF de um RDO. Download individual e lote passam por aqui (saem idênticos). */
export async function renderizarRdo(
  turno: TurnoCompleto,
  emissao: Emissao,
  empresaNome: string | null,
  fotos?: Record<string, Uint8Array>,
): Promise<Buffer> {
  return renderToBuffer(
    createElement(DocumentoRdo, { turno, resumo: resumirTurno(turno), emissao, fotos, empresaNome }) as ReactElement<DocumentProps>,
  );
}

/** PDF do RDO como anexo para download. */
/** `empresaNome`: o nome atual da empresa (não o da foto da versão). */
export async function respostaPdf(
  turno: TurnoCompleto,
  emissao: Emissao,
  nomeArquivo: string,
  empresaNome: string | null,
): Promise<Response> {
  // Download individual leva as fotos das paradas (o lote não: limite de resposta do Vercel).
  const fotos = await bytesFotos(turno.ocorrencias.map((o) => o.foto_path ?? ""));
  let pdf: Buffer;
  try {
    pdf = await renderizarRdo(turno, emissao, empresaNome, fotos);
  } catch (e) {
    // Uma foto que não renderiza não pode impedir o RDO: sai sem as fotos.
    if (Object.keys(fotos).length === 0) throw e;
    console.error("respostaPdf (fotos):", e instanceof Error ? e.message : e);
    pdf = await renderizarRdo(turno, emissao, empresaNome);
  }
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
      await obterNomeEmpresa(c),
    );
  } catch (e) {
    console.error("respostaVersao:", e instanceof Error ? e.message : e);
    return Response.json({ erro: ERRO_GERAR_RDO }, { status: 500 });
  }
}
