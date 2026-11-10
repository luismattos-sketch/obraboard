import { caminhoSeguro } from "./caminho";

export type ParamsConfirmacao = {
  code?: string | null;
  token_hash?: string | null;
  type?: string | null;
  error_code?: string | null;
  error?: string | null;
  proximo?: string | null;
};

const EXPIRADO = "/login?erro=link-expirado";
const CONFIRMADO = "/login?aviso=email-confirmado";

/**
 * Decide o destino após /auth/confirmar. `resultadoTroca` é o resultado da
 * troca do code ou da verificação do token_hash (null se não tentada).
 */
export function destinoConfirmacao(
  params: ParamsConfirmacao,
  resultadoTroca: "ok" | "falhou" | null,
): string {
  if (params.error_code === "otp_expired") return EXPIRADO;
  const proximo = caminhoSeguro(params.proximo);
  if (resultadoTroca === "ok") return proximo;

  const recuperacao = proximo === "/redefinir-senha";
  const falhaDeCode = (resultadoTroca === "falhou" && !!params.code) || (resultadoTroca === null && !!params.error);
  // Cadastro: o e-mail já foi verificado pelo Supabase em /verify; só a sessão não foi criada.
  if (falhaDeCode && !recuperacao) return CONFIRMADO;
  return EXPIRADO;
}
