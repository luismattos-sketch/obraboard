import { redirect } from "next/navigation";
import { retornoDoLote } from "@/lib/dominio/lote-rdo";
import { respostaLote } from "@/lib/rdo/lote";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Até 120 RDOs renderizados em sequência (~11 s medidos localmente); folga para não ser cortado no meio.
export const maxDuration = 60;

/** PDF único com a versão atual de cada RDO do mês (?mes=AAAA-MM, ?obra= opcional). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const supabase = await criarClienteServidor();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    // Sem sessão: entrar e voltar para a lista (o clique gera o PDF uma vez só). Redirect fora de try/catch.
    const voltar = retornoDoLote(url.searchParams.get("mes"), url.searchParams.get("obra"));
    redirect(`/login?proximo=${encodeURIComponent(voltar)}`);
  }
  return respostaLote(supabase, url.searchParams.get("mes"), url.searchParams.get("obra"));
}
