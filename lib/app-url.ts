const appUrlPadrao = "https://obraboard-five.vercel.app";

export function obterAppUrl() {
  const configurada = process.env.NEXT_PUBLIC_APP_URL?.trim() || appUrlPadrao;
  return configurada.replace(/\/+$/, "");
}

export function obterAuthCallbackUrl() {
  return `${obterAppUrl()}/auth/callback`;
}
