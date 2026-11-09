import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { caminhoSeguro } from "@/lib/dominio/caminho";
import { criarClienteServidor } from "@/lib/supabase/servidor";

const TIPOS: readonly string[] = ["email", "recovery", "signup", "email_change"];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const tipo = params.get("type") as EmailOtpType | null;
  const proximo = caminhoSeguro(params.get("proximo"));

  if (tokenHash && tipo && TIPOS.includes(tipo)) {
    const supabase = await criarClienteServidor();
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(proximo, request.nextUrl.origin));
  }
  return NextResponse.redirect(new URL("/login?erro=link-expirado", request.nextUrl.origin));
}
