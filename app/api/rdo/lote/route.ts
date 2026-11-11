import { redirect } from "next/navigation";
import { caminhoSeguro } from "@/lib/dominio/caminho";
import { respostaLote } from "@/lib/rdo/lote";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Até 120 RDOs renderizados em sequência (~150 ms cada); folga para não ser cortado no meio.
export const maxDuration = 60;

/** PDF único com a versão atual de cada RDO do mês (?mes=AAAA-MM, ?obra= opcional). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const supabase = await criarClienteServidor();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    // Sem sessão: entrar e voltar para o download (redirect fora de try/catch).
    redirect(`/login?proximo=${encodeURIComponent(caminhoSeguro(url.pathname + url.search))}`);
  }
  return respostaLote(supabase, url.searchParams.get("mes"), url.searchParams.get("obra"));
}
