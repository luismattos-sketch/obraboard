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
  obraId,
  turnoId,
}: {
  obraId: number | string | null | undefined;
  turnoId: number | string | null | undefined;
}) {
  if (!obraId || !turnoId || typeof window === "undefined") {
    return null;
  }

  return `${window.location.origin}/campo?obraId=${obraId}&turnoId=${turnoId}`;
}
