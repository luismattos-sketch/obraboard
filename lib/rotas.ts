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

export function criarCampoPath(obraId: number | string | null | undefined) {
  return criarRotaComObra("/campo", obraId);
}

export function criarCampoUrl(
  origem: string,
  obraId: number | string | null | undefined
) {
  if (!origem || !obraId) {
    return "";
  }

  return new URL(criarCampoPath(obraId), origem).toString();
}
