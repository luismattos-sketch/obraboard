import type { ClimaTurno, HoraClima, JanelaClima } from "./tipos";

type TurnoJanela = {
  data: string;
  hora_inicio_real: string | null;
  hora_fim_real: string | null;
  hora_inicio_prevista: string | null;
  hora_fim_prevista: string | null;
};

function diaSeguinte(data: string): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Janela do turno (real senão previsto); fim ≤ início ⇒ fim no dia seguinte. */
export function janelaDoTurno(t: TurnoJanela): JanelaClima | null {
  const ini = (t.hora_inicio_real ?? t.hora_inicio_prevista)?.slice(0, 5);
  const fim = (t.hora_fim_real ?? t.hora_fim_prevista)?.slice(0, 5);
  if (!ini || !fim) return null;
  const diaFim = fim <= ini ? diaSeguinte(t.data) : t.data;
  return { inicio: `${t.data}T${ini}`, fim: `${diaFim}T${fim}` };
}

/** "Agora" em hora local da obra ("YYYY-MM-DDTHH:MM"). */
export function agoraLocal(agora: Date, utcOffsetSeconds: number): string {
  return new Date(agora.getTime() + utcOffsetSeconds * 1000).toISOString().slice(0, 16);
}

const horaCheia = (s: string) => `${s.slice(0, 13)}:00`;
const uma = (n: number) => Math.round(n * 10) / 10;

/** Resumo e leituras (de 2 em 2h, sempre com a última) das horas dentro da janela, até "agora". */
export function montarClima(horas: HoraClima[], janela: JanelaClima, agora: string): ClimaTurno | null {
  const de = horaCheia(janela.inicio);
  const fimJanela = horaCheia(janela.fim);
  const agoraH = horaCheia(agora);
  const ate = fimJanela < agoraH ? fimJanela : agoraH;
  const dentro = horas.filter((h) => h.hora >= de && h.hora <= ate).sort((a, b) => a.hora.localeCompare(b.hora));
  if (dentro.length === 0) return null;
  const temps = dentro.map((h) => h.temperatura);
  const chuva = uma(dentro.reduce((s, h) => s + h.chuva_mm, 0));
  const leituras = dentro.filter((_, i) => i % 2 === 0);
  const ultima = dentro[dentro.length - 1];
  if (leituras[leituras.length - 1] !== ultima) leituras.push(ultima);
  return {
    temp_media: uma(temps.reduce((s, n) => s + n, 0) / temps.length),
    temp_max: uma(Math.max(...temps)),
    temp_min: uma(Math.min(...temps)),
    chuva_mm: chuva,
    choveu: chuva >= 0.5,
    leituras,
  };
}

/** Rótulo em português do código de tempo WMO. */
export function rotuloTempo(codigo: number): string {
  if (codigo === 0) return "Céu limpo";
  if (codigo === 1 || codigo === 2) return "Poucas nuvens";
  if (codigo === 3) return "Nublado";
  if (codigo === 45 || codigo === 48) return "Neblina";
  if (codigo >= 51 && codigo <= 57) return "Garoa";
  if ([61, 66, 80].includes(codigo)) return "Chuva fraca";
  if ([63, 81].includes(codigo)) return "Chuva";
  if ([65, 67, 82].includes(codigo)) return "Chuva forte";
  if ((codigo >= 71 && codigo <= 77) || codigo === 85 || codigo === 86) return "Neve";
  if (codigo >= 95 && codigo <= 99) return "Tempestade";
  return "—";
}
