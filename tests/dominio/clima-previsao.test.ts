import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/clima/openmeteo", () => ({
  buscarHoras: vi.fn(async (_la: number, _lo: number, dia: string) => ({
    utcOffsetSeconds: -10800,
    horas: Array.from({ length: 24 }, (_, h) => ({ hora: `${dia}T${String(h).padStart(2, "0")}:00`, temperatura: 20 + (h % 5), chuva_mm: 0, codigo: 0 })),
  })),
}));

import { climaParaTela } from "@/lib/clima/tela";

const turno = {
  status: "planejado" as const,
  obra: { latitude: -20, longitude: -40 },
  clima_turno: null,
  data: "2030-01-10",
  hora_inicio_real: null,
  hora_fim_real: null,
  hora_inicio_prevista: "07:00",
  hora_fim_prevista: "17:00",
};

describe("climaParaTela — previsão", () => {
  it("turno planejado com previsão traz a janela inteira", async () => {
    const r = await climaParaTela(turno as never, { previsao: true });
    expect(r.previsao).toBe(true);
    expect(r.clima?.leituras[0].hora).toBe("2030-01-10T07:00");
    expect(r.clima?.leituras.at(-1)?.hora).toBe("2030-01-10T17:00");
  });
  it("sem a opção, planejado continua indisponível", async () => {
    const r = await climaParaTela(turno as never);
    expect(r).toMatchObject({ clima: null, aviso: "indisponivel", previsao: false });
  });
  it("em campo antes do início (sem leituras ainda) cai na previsão", async () => {
    const r = await climaParaTela({ ...turno, status: "em_campo", data: "2099-01-10" } as never, { previsao: true });
    expect(r.previsao).toBe(true);
    expect(r.clima).not.toBeNull();
  });
});
