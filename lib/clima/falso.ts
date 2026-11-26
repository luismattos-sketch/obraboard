// Clima de mentira para testes, E2E e capturas do manual (FRENTIA_CLIMA_FALSO=1). Nunca usado em produção.
import type { Cidade, HoraClima } from "./tipos";

const simples = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const CIDADES: Cidade[] = [
  { nome: "Macaé, Rio de Janeiro", latitude: -22.37, longitude: -41.79 },
  { nome: "Rio de Janeiro, Rio de Janeiro", latitude: -22.91, longitude: -43.18 },
  { nome: "São Paulo, São Paulo", latitude: -23.55, longitude: -46.64 },
];

export const climaFalsoLigado = () => process.env.FRENTIA_CLIMA_FALSO === "1";

export function cidadesFalsas(termo: string): Cidade[] {
  const t = simples(termo.trim());
  return CIDADES.filter((c) => simples(c.nome).includes(t));
}

export function horasFalsas(dataInicio: string, dataFim: string): { horas: HoraClima[]; utcOffsetSeconds: number } {
  const horas: HoraClima[] = [];
  const d = new Date(`${dataInicio}T00:00:00Z`);
  const fim = new Date(`${dataFim}T00:00:00Z`);
  while (d <= fim) {
    const dia = d.toISOString().slice(0, 10);
    for (let h = 0; h < 24; h++) {
      const chuva = h === 13 || h === 14;
      horas.push({ hora: `${dia}T${String(h).padStart(2, "0")}:00`, temperatura: 22 + (h % 12), chuva_mm: chuva ? 1.5 : 0, codigo: chuva ? 61 : 1 });
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return { horas, utcOffsetSeconds: -10800 };
}
