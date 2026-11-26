import { describe, it, expect } from "vitest";
import { janelaDoTurno, agoraLocal, montarClima, rotuloTempo } from "@/lib/clima/montar";
import type { HoraClima } from "@/lib/clima/tipos";

const base = { data: "2026-11-25", hora_inicio_real: null, hora_fim_real: null, hora_inicio_prevista: "07:00:00", hora_fim_prevista: "17:30:00" };

function serie(dia: string, de: number, ate: number): HoraClima[] {
  const r: HoraClima[] = [];
  for (let h = de; h <= ate; h++) {
    const chuva = h === 13 || h === 14;
    r.push({ hora: `${dia}T${String(h).padStart(2, "0")}:00`, temperatura: h, chuva_mm: chuva ? 2 : 0, codigo: chuva ? 61 : 0 });
  }
  return r;
}
const horasLeitura = (c: { leituras: HoraClima[] } | null) => c!.leituras.map((l) => l.hora.slice(11, 13));

describe("janelaDoTurno", () => {
  it("usa o previsto quando não há real", () => {
    expect(janelaDoTurno(base)).toEqual({ inicio: "2026-11-25T07:00", fim: "2026-11-25T17:30" });
  });
  it("real prevalece", () => {
    expect(janelaDoTurno({ ...base, hora_inicio_real: "07:20:00", hora_fim_real: "16:10:00" })).toEqual({ inicio: "2026-11-25T07:20", fim: "2026-11-25T16:10" });
  });
  it("noturno atravessa a meia-noite", () => {
    expect(janelaDoTurno({ ...base, hora_inicio_prevista: "19:00:00", hora_fim_prevista: "05:00:00" })).toEqual({ inicio: "2026-11-25T19:00", fim: "2026-11-26T05:00" });
  });
  it("sem fim ⇒ null", () => {
    expect(janelaDoTurno({ ...base, hora_fim_prevista: null })).toBeNull();
  });
});

describe("agoraLocal", () => {
  it("aplica o deslocamento", () => {
    expect(agoraLocal(new Date("2026-11-25T17:10:00Z"), -10800)).toBe("2026-11-25T14:10");
  });
});

describe("montarClima", () => {
  const horas = serie("2026-11-25", 6, 18);
  const janela = { inicio: "2026-11-25T07:00", fim: "2026-11-25T17:30" };

  it("leituras de 2 em 2h e resumo", () => {
    const c = montarClima(horas, janela, "2026-11-25T20:00");
    expect(horasLeitura(c)).toEqual(["07", "09", "11", "13", "15", "17"]);
    expect(c).toMatchObject({ temp_media: 12, temp_max: 17, temp_min: 7, chuva_mm: 4, choveu: true });
  });
  it("sempre inclui a última hora", () => {
    expect(horasLeitura(montarClima(horas, { ...janela, fim: "2026-11-25T16:00" }, "2026-11-25T20:00")).slice(-2)).toEqual(["15", "16"]);
  });
  it("não passa de agora", () => {
    const c = montarClima(horas, janela, "2026-11-25T14:10");
    expect(horasLeitura(c)).toEqual(["07", "09", "11", "13", "14"]);
    expect(c!.temp_max).toBe(14);
  });
  it("chuva pequena não conta", () => {
    const h = horas.map((x) => ({ ...x, chuva_mm: x.hora.endsWith("13:00") ? 0.3 : 0 }));
    expect(montarClima(h, janela, "2026-11-25T20:00")!.choveu).toBe(false);
  });
  it("agora antes do início ⇒ null", () => {
    expect(montarClima(horas, janela, "2026-11-25T06:30")).toBeNull();
  });
  it("noturno usa os dois dias", () => {
    const h = [...serie("2026-11-25", 18, 23), ...serie("2026-11-26", 0, 6)];
    const c = montarClima(h, { inicio: "2026-11-25T19:00", fim: "2026-11-26T05:00" }, "2026-11-26T09:00");
    expect(c!.leituras[0].hora).toBe("2026-11-25T19:00");
    expect(c!.leituras.at(-1)!.hora).toBe("2026-11-26T05:00");
  });
});

describe("rotuloTempo", () => {
  it("rótulos", () => {
    expect(rotuloTempo(0)).toBe("Céu limpo");
    expect(rotuloTempo(63)).toBe("Chuva");
    expect(rotuloTempo(95)).toBe("Tempestade");
    expect(rotuloTempo(4)).toBe("—");
  });
});
