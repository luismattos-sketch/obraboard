import type { Cidade, HoraClima } from "./tipos";
import { cidadesFalsas, climaFalsoLigado, horasFalsas } from "./falso";

const URL_CLIMA = () => process.env.OPEN_METEO_URL || "https://api.open-meteo.com/v1/forecast";
const URL_GEO = () => process.env.OPEN_METEO_GEO_URL || "https://geocoding-api.open-meteo.com/v1/search";

async function pegarJson(url: string, revalidar?: number): Promise<unknown | null> {
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      ...(revalidar ? { next: { revalidate: revalidar } } : { cache: "no-store" as const }),
    });
    if (!r.ok) {
      console.error("[clima] HTTP", r.status, url);
      return null;
    }
    return await r.json();
  } catch (e) {
    console.error("[clima] falha ao consultar", url, e);
    return null;
  }
}

type RespostaHoras = {
  utc_offset_seconds?: number;
  hourly?: { time?: string[]; temperature_2m?: (number | null)[]; precipitation?: (number | null)[]; weather_code?: (number | null)[] };
};

/** Horas de clima (hora local da obra) entre duas datas. Nunca lança: falha ⇒ null. */
export async function buscarHoras(
  lat: number, lon: number, dataInicio: string, dataFim: string, opcoes: { revalidar?: number } = {},
): Promise<{ horas: HoraClima[]; utcOffsetSeconds: number } | null> {
  if (climaFalsoLigado()) return horasFalsas(dataInicio, dataFim);
  const q = new URLSearchParams({
    latitude: String(lat), longitude: String(lon),
    hourly: "temperature_2m,precipitation,weather_code",
    timezone: "auto", start_date: dataInicio, end_date: dataFim,
  });
  const j = (await pegarJson(`${URL_CLIMA()}?${q}`, opcoes.revalidar)) as RespostaHoras | null;
  const h = j?.hourly;
  if (!h?.time) return null;
  const horas: HoraClima[] = [];
  h.time.forEach((hora, i) => {
    const t = h.temperature_2m?.[i], p = h.precipitation?.[i], c = h.weather_code?.[i];
    if (t == null || p == null || c == null) return;
    horas.push({ hora, temperatura: t, chuva_mm: p, codigo: c });
  });
  return { horas, utcOffsetSeconds: j!.utc_offset_seconds ?? 0 };
}

type RespostaGeo = { results?: { name: string; admin1?: string; latitude: number; longitude: number }[] };

/** Cidades do Brasil que batem com o termo (mín. 2 caracteres). Falha ⇒ []. */
export async function buscarCidades(termo: string): Promise<Cidade[]> {
  const t = termo.trim();
  if (t.length < 2) return [];
  if (climaFalsoLigado()) return cidadesFalsas(t);
  const q = new URLSearchParams({ name: t, count: "6", language: "pt", countryCode: "BR" });
  const j = (await pegarJson(`${URL_GEO()}?${q}`)) as RespostaGeo | null;
  return (j?.results ?? []).map((r) => ({
    nome: r.admin1 ? `${r.name}, ${r.admin1}` : r.name,
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}
