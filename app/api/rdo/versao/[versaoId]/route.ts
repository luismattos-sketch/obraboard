import { redirect } from "next/navigation";
import { caminhoSeguro } from "@/lib/dominio/caminho";
import { respostaVersao } from "@/lib/rdo/responder";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Download de uma versão oficial do RDO (somente membros da empresa da obra, via RLS). */
export async function GET(_req: Request, { params }: { params: Promise<{ versaoId: string }> }) {
  const { versaoId } = await params;
  const supabase = await criarClienteServidor();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    // Sem sessão: entrar e voltar para o download (redirect fora de try/catch).
    const voltar = caminhoSeguro(`/api/rdo/versao/${encodeURIComponent(versaoId)}`);
    redirect(`/login?proximo=${encodeURIComponent(voltar)}`);
  }
  return respostaVersao(supabase, versaoId);
}
