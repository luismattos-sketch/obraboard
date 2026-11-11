import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import { listarVersoes, obterVersoes } from "@/lib/db/rdo-versoes";
import { normalizarMes, rotuloMes } from "@/lib/dominio/historico-rdo";
import { LIMITE_LOTE, paginasIniciais, selecionarLote, type ItemLote } from "@/lib/dominio/lote-rdo";
import { CapaLote, type CabecalhoLote } from "./capa-lote";
import { nomeArquivoLote } from "./nome-arquivo";
import { renderizarRdo } from "./responder";
import { emissaoDaVersao, lerFoto, type VersaoRdo } from "./versao";

export type { CabecalhoLote } from "./capa-lote";

async function capa(cabecalho: CabecalhoLote, lote: ItemLote[], paginas: number[]): Promise<Buffer> {
  return renderToBuffer(createElement(CapaLote, { cabecalho, lote, paginas }) as ReactElement<DocumentProps>);
}

/**
 * Capa com o índice certo: supõe 1 página; se ela ocupar mais, refaz com a contagem real
 * (o número de linhas não muda, então a 2ª tentativa tem o mesmo tamanho).
 */
export async function renderizarCapa(
  cabecalho: CabecalhoLote,
  lote: ItemLote[],
  paginasPorRdo: number[],
): Promise<{ buffer: Buffer; paginas: number[] }> {
  let paginas = paginasIniciais(1, paginasPorRdo);
  let buffer = await capa(cabecalho, lote, paginas);
  const total = (await PDFDocument.load(buffer)).getPageCount();
  if (total > 1) {
    paginas = paginasIniciais(total, paginasPorRdo);
    buffer = await capa(cabecalho, lote, paginas);
  }
  return { buffer, paginas };
}

/** PDF único: capa + cada RDO idêntico ao download individual. Sem banco (recebe as fotos). */
export async function montarLote(lote: ItemLote[], versoes: VersaoRdo[], cabecalho: CabecalhoLote): Promise<Uint8Array> {
  const porId = new Map(versoes.map((v) => [v.id, v]));
  const rdos: PDFDocument[] = [];
  for (const item of lote) {
    const v = porId.get(item.atual.id);
    if (!v) throw new Error(`montarLote: versão ${item.atual.id} não encontrada`);
    // Em sequência, para não segurar dezenas de renderizações na memória ao mesmo tempo.
    const buf = await renderizarRdo(lerFoto(v), emissaoDaVersao(v, item.anterior));
    rdos.push(await PDFDocument.load(buf));
  }

  const { buffer } = await renderizarCapa(cabecalho, lote, rdos.map((d) => d.getPageCount()));
  const final = await PDFDocument.create();
  for (const doc of [await PDFDocument.load(buffer), ...rdos]) {
    for (const p of await final.copyPages(doc, doc.getPageIndices())) final.addPage(p);
  }
  final.setTitle(`RDOs — ${cabecalho.obraNome ?? "Todas as obras"} — ${rotuloMes(cabecalho.mes)}`);
  final.setAuthor("Frentia");
  final.setCreator("Frentia");
  final.setProducer("Frentia");
  return final.save();
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ERRO_GERAR_LOTE = "Não foi possível gerar o arquivo";

/** Lote vazio ou grande demais: o erro para a resposta; `null` se pode gerar. */
export function validarLote(lote: ItemLote[]): { status: 404 | 422; erro: string } | null {
  if (lote.length === 0) return { status: 404, erro: "Nenhum RDO neste filtro" };
  if (lote.length > LIMITE_LOTE) return { status: 422, erro: "Muitos RDOs neste filtro; escolha uma obra" };
  return null;
}

/** Resposta do download em lote para um usuário já autenticado (RLS limita à empresa dele). */
export async function respostaLote(c: SupabaseClient, mesBruto: string | null, obra: string | null): Promise<Response> {
  const mes = normalizarMes(mesBruto);
  if (!mes) return Response.json({ erro: "Escolha um mês" }, { status: 400 });
  if (obra !== null && !UUID.test(obra)) return Response.json({ erro: "Obra inválida" }, { status: 400 });
  try {
    const lote = selecionarLote(await listarVersoes(c, obra ? { obraId: obra } : {}), mes, obra);
    const invalido = validarLote(lote);
    if (invalido) return Response.json({ erro: invalido.erro }, { status: invalido.status });
    // Com obra: o nome do RDO mais recente dela (é o rótulo usado na ordenação).
    const obraNome = obra
      ? lote.reduce((a, b) => (b.atual.emitidoEm > a.atual.emitidoEm ? b : a)).atual.obraNome
      : null;
    const pdf = await montarLote(lote, await obterVersoes(c, lote.map((l) => l.atual.id)), {
      mes, obraNome, geradoEm: new Date(),
    });
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nomeArquivoLote(obraNome, mes)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("respostaLote:", e instanceof Error ? e.message : e);
    return Response.json({ erro: ERRO_GERAR_LOTE }, { status: 500 });
  }
}
