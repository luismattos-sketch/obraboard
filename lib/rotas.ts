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
  const obra = String(obraId ?? "").trim();
  const turno = String(turnoId ?? "").trim();

  if (!obra || !turno || typeof window === "undefined") {
    return null;
  }

  return `${window.location.origin}/campo?obraId=${obra}&turnoId=${turno}`;
}
