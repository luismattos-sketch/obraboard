import { createElement, type ReactElement } from "react";
import { redirect } from "next/navigation";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { obterNomeEmpresa } from "@/lib/db/empresas";
import { bytesFotos } from "@/lib/db/fotosParada";
import { obterObra } from "@/lib/db/obras";
import { listarResponsaveis } from "@/lib/db/responsaveis";
import { turnosDoRelatorio } from "@/lib/db/relatorioObra";
import { inicioDaObra } from "@/lib/db/turnos";
import { hojeSaoPaulo } from "@/lib/dominio/entrada";
import { montarRelatorio, periodoDoRelatorio } from "@/lib/dominio/relatorioObra";
import { nomeArquivoRelatorio } from "@/lib/rdo/nome-arquivo";
import { DocumentoRelatorioObra, fotosDoRelatorio } from "@/lib/rdo/relatorioObra";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Item 4.4: Relatório da Obra em PDF (?obra=ID&tipo=semana|mes|obra&valor=AAAA-MM-DD|AAAA-MM). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const obraId = url.searchParams.get("obra") ?? "";
  const supabase = await criarClienteServidor();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?proximo=${encodeURIComponent(`/obras/${obraId}/rdos`)}`);

  const obra = await obterObra(supabase, obraId);
  if (!obra) return Response.json({ erro: "Obra não encontrada" }, { status: 404 });
  const hoje = hojeSaoPaulo();
  const inicio = await inicioDaObra(supabase, obra.id, obra.created_at).catch(() => hoje);
  const periodo = periodoDoRelatorio(url.searchParams.get("tipo"), url.searchParams.get("valor"), hoje, inicio);
  if (!periodo) return Response.json({ erro: "Período inválido" }, { status: 400 });

  try {
    const [turnos, responsaveis, empresaNome] = await Promise.all([
      turnosDoRelatorio(supabase, obra.id, periodo.de, periodo.ate),
      listarResponsaveis(supabase, obra.id),
      obterNomeEmpresa(supabase),
    ]);
    const relatorio = montarRelatorio(turnos, responsaveis);
    const { fotos, fora } = fotosDoRelatorio(relatorio);
    const cabecalho = { obraNome: obra.nome, cliente: obra.cliente, empresaNome, periodo: periodo.rotulo, geradoEm: new Date() };
    const render = (bytes: Record<string, Uint8Array>) =>
      renderToBuffer(
        createElement(DocumentoRelatorioObra, { cabecalho, relatorio, fotos, fotosFora: fora, bytes }) as ReactElement<DocumentProps>,
      );
    const bytes = await bytesFotos(fotos.map((f) => f.caminho));
    let pdf: Buffer;
    try {
      pdf = await render(bytes);
    } catch (e) {
      // Uma foto que não renderiza não pode impedir o relatório: sai sem as fotos.
      if (Object.keys(bytes).length === 0) throw e;
      console.error("relatorio-obra (fotos):", e instanceof Error ? e.message : e);
      pdf = await render({});
    }
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nomeArquivoRelatorio(obra.nome, periodo.de, periodo.ate)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("relatorio-obra:", e instanceof Error ? e.message : e);
    return Response.json({ erro: "Não foi possível gerar o relatório" }, { status: 500 });
  }
}
