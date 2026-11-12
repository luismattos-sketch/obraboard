/** Seguro para servidor e cliente (sem imports server-only). */
export function urlCampo(token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return `${base}/t/${token}`;
}

export function urlQuadro(codigo: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return `${base}/q/${codigo}`;
}
