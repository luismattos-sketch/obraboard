import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
import { rotuloMes } from "@/lib/dominio/historico-rdo";
import { paginasIniciais, type ItemLote } from "@/lib/dominio/lote-rdo";
import { CapaLote, type CabecalhoLote } from "./capa-lote";
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
