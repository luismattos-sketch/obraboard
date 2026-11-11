import { redirect } from "next/navigation";
import { versoesDoTurno } from "@/lib/db/rdo-versoes";
import { obterTurnoCompleto } from "@/lib/db/turnos";
import { caminhoSeguro } from "@/lib/dominio/caminho";
import { nomeArquivoRdo } from "@/lib/rdo/nome-arquivo";
import { ERRO_GERAR_RDO, respostaPdf, respostaVersao } from "@/lib/rdo/responder";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Turno fechado: versão oficial mais recente. Turno aberto: prévia em rascunho. */
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

  if (turno.status === "fechado") {
    const ultima = (await versoesDoTurno(supabase, turno.id)).at(-1);
    if (!ultima) {
      console.error("RDO: turno fechado sem versão:", turno.id);
      return Response.json({ erro: ERRO_GERAR_RDO }, { status: 500 });
    }
    return respostaVersao(supabase, ultima.id);
  }

  return respostaPdf(
    turno,
    { tipo: "rascunho", geradoEm: new Date() },
    nomeArquivoRdo(turno.obra.nome, turno.data, turno.periodo, "rascunho"),
  );
}
