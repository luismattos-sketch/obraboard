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

export function criarCampoPath(
  obraId: number | string | null | undefined,
  turnoId: number | string | null | undefined
) {
  if (!obraId || !turnoId) {
    return "";
  }

  const params = new URLSearchParams();
  params.set("obraId", String(obraId));
  params.set("turnoId", String(turnoId));

  return `/campo?${params.toString()}`;
}

export function criarCampoUrl(
  origem: string,
  obraId: number | string | null | undefined,
  turnoId: number | string | null | undefined
) {
  if (!origem || !obraId || !turnoId) {
    return "";
  }

  return new URL(criarCampoPath(obraId, turnoId), origem).toString();
}
