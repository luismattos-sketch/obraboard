export function criarCampoPath(obraId: number | string | null | undefined) {
  if (!obraId) {
    return "/campo";
  }

  return `/campo?obraId=${encodeURIComponent(String(obraId))}`;
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
