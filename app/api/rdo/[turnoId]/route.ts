import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { obterTurnoCompleto } from "@/lib/db/turnos";
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
  if (!auth.user) return Response.json({ erro: "Não autenticado" }, { status: 401 });

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
