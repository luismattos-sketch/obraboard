import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { destinoConfirmacao } from "@/lib/dominio/confirmar";
import { criarClienteServidor } from "@/lib/supabase/servidor";

const TIPOS: readonly string[] = ["email", "recovery", "signup", "email_change"];

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const params = {
    code: p.get("code"),
    token_hash: p.get("token_hash"),
    type: p.get("type"),
    error_code: p.get("error_code"),
    error: p.get("error"),
    proximo: p.get("proximo"),
  };

  let resultado: "ok" | "falhou" | null = null;
  if (!params.error_code && !params.error) {
    if (params.code) {
      const supabase = await criarClienteServidor();
      const { error } = await supabase.auth.exchangeCodeForSession(params.code);
      resultado = error ? "falhou" : "ok";
    } else if (params.token_hash && params.type && TIPOS.includes(params.type)) {
      const supabase = await criarClienteServidor();
      const { error } = await supabase.auth.verifyOtp({
        type: params.type as EmailOtpType,
        token_hash: params.token_hash,
      });
      resultado = error ? "falhou" : "ok";
    }
  }
  return NextResponse.redirect(new URL(destinoConfirmacao(params, resultado), request.nextUrl.origin));
}
