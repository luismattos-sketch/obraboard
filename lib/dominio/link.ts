/** Seguro para servidor e cliente (sem imports server-only). */
export function urlCampo(token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return `${base}/t/${token}`;
}

export function urlQuadro(codigo: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return `${base}/q/${codigo}`;
}

export function urlCiencia(codigo: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return `${base}/c/${codigo}`;
}

export const TEXTO_LINK_ANTIGO =
  "Este link foi criado antes desta atualização e não pode ser exibido. Gere um novo para vê-lo aqui sempre.";

/** O link guardado no servidor vence o gerado nesta aba: outra aba/pessoa pode tê-lo trocado depois. */
export function linkExibido(gerado: string | null | undefined, atual: string | null): string | null {
  return atual ?? gerado ?? null;
}
