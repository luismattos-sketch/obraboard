import { agoraLocal, janelaDoTurno, montarClima } from "./montar";
import { buscarHoras } from "./openmeteo";
import type { ClimaTurno } from "./tipos";

/** Clima do turno pela cidade da obra. Sem cidade, sem janela ou falha ⇒ null. */
export async function obterClimaTurno(
  obra: { latitude?: number | null; longitude?: number | null },
  turno: Parameters<typeof janelaDoTurno>[0],
  opcoes: { agora?: Date; revalidar?: number } = {},
): Promise<ClimaTurno | null> {
  if (obra.latitude == null || obra.longitude == null) return null;
  const janela = janelaDoTurno(turno);
  if (!janela) return null;
  const r = await buscarHoras(obra.latitude, obra.longitude, janela.inicio.slice(0, 10), janela.fim.slice(0, 10), { revalidar: opcoes.revalidar });
  if (!r) return null;
  return montarClima(r.horas, janela, agoraLocal(opcoes.agora ?? new Date(), r.utcOffsetSeconds));
}
