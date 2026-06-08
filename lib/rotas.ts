export function criarRotaComObra(
  path: string,
  obraId: number | string | null | undefined
) {
  if (!obraId) {
    return path;
  }

  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("obraId", String(obraId));

  return `${pathname}?${params.toString()}`;
}

export function gerarCampoUrl({
  token,
}: {
  token: string | null | undefined;
}) {
  const tokenPublico = String(token ?? "").trim();

  if (!tokenPublico || typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams();
  params.set("token", tokenPublico);

  return `${window.location.origin}/campo?${params.toString()}`;
}
