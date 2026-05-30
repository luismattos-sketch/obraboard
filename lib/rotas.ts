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
  dataTurno,
}: {
  obraId: number | string | null | undefined;
  turnoId: number | string | null | undefined;
  dataTurno?: string | null | undefined;
}) {
  const obra = String(obraId ?? "").trim();
  const turno = String(turnoId ?? "").trim();
  const data = String(dataTurno ?? "").trim();

  if (!obra || !turno || typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams();
  params.set("obraId", obra);
  params.set("turnoId", turno);

  if (data) {
    params.set("dataTurno", data);
  }

  return `${window.location.origin}/campo?${params.toString()}`;
}
