import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { redirect } from "next/navigation";
import { obterTurnoCompleto } from "@/lib/db/turnos";
import { caminhoSeguro } from "@/lib/dominio/caminho";
import { resumirTurno } from "@/lib/dominio/resumo";
import { DocumentoRdo } from "@/lib/rdo/documento";
import { nomeArquivoRdo } from "@/lib/rdo/nome-arquivo";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ turnoId: string }> }) {
  const { turnoId } = await params;
  const supabase = await criarClienteServidor();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    // Sem sessão: entrar e voltar para o download (redirect fora de try/catch).
    const voltar = caminhoSeguro(`/api/rdo/${encodeURIComponent(turnoId)}`);
    redirect(`/login?proximo=${encodeURIComponent(voltar)}`);
  }

  const turno = await obterTurnoCompleto(supabase, turnoId);
  if (!turno) return Response.json({ erro: "Turno não encontrado" }, { status: 404 });

  const pdf = await renderToBuffer(
    createElement(DocumentoRdo, { turno, resumo: resumirTurno(turno), geradoEm: new Date() }) as ReactElement<DocumentProps>,
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomeArquivoRdo(turno.obra.nome, turno.data, turno.periodo)}"`,
      "Cache-Control": "no-store",
    },
  });
}
