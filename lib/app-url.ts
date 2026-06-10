const appUrlPadrao = "https://obraboard-five.vercel.app";

export function obterAppUrl() {
  const configurada = process.env.NEXT_PUBLIC_APP_URL?.trim() || appUrlPadrao;

  try {
    const url = new URL(configurada);
    const hostLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);

    if (process.env.NODE_ENV === "production" && hostLocal) {
      return appUrlPadrao;
    }

    return url.toString().replace(/\/+$/, "");
  } catch {
    return appUrlPadrao;
  }
}

export function obterAuthCallbackUrl() {
  return `${obterAppUrl()}/auth/callback`;
}
