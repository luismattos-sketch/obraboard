import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ClimaTurno } from "@/components/execucao/ClimaTurno";
import { montarClima } from "@/lib/clima/montar";
import type { HoraClima } from "@/lib/clima/tipos";

const horas: HoraClima[] = Array.from({ length: 13 }, (_, i) => {
  const h = 6 + i;
  const chuva = h === 13 || h === 14;
  return { hora: `2026-11-25T${String(h).padStart(2, "0")}:00`, temperatura: h, chuva_mm: chuva ? 2 : 0, codigo: chuva ? 61 : 0 };
});
const clima = montarClima(horas, { inicio: "2026-11-25T07:00", fim: "2026-11-25T17:30" }, "2026-11-25T20:00");

describe("ClimaTurno", () => {
  it("mostra média, chuva, leituras e fonte", () => {
    const html = renderToStaticMarkup(<ClimaTurno clima={clima} paradasClima={0} />);
    for (const t of ["12°", "Choveu · 4 mm", "07h", "Chuva fraca", "Dados: Open-Meteo", "média do turno"]) expect(html).toContain(t);
    expect(html).not.toContain("Atividades paradas por clima");
  });
  it("conta as atividades paradas por clima", () => {
    expect(renderToStaticMarkup(<ClimaTurno clima={clima} paradasClima={2} />)).toContain("Atividades paradas por clima: 2");
  });
  it("em campo diz 'Clima até agora'", () => {
    expect(renderToStaticMarkup(<ClimaTurno clima={clima} paradasClima={0} parcial />)).toContain("Clima até agora");
  });
  it("obra sem cidade: aviso com link", () => {
    const html = renderToStaticMarkup(<ClimaTurno clima={null} paradasClima={0} aviso="sem_cidade" linkObra="/obras/x" />);
    expect(html).toContain("informe a cidade da obra");
    expect(html).toContain('href="/obras/x"');
    expect(html).toContain("Informar cidade");
  });
});
