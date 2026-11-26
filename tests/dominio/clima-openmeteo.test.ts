import { describe, it, expect, vi, afterEach } from "vitest";
import { buscarHoras, buscarCidades } from "@/lib/clima/openmeteo";
import { obterClimaTurno } from "@/lib/clima/obter";

const resp = (corpo: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(corpo), { status }));
const turno = { data: "2026-11-25", hora_inicio_real: null, hora_fim_real: null, hora_inicio_prevista: "07:00:00", hora_fim_prevista: "17:00:00" };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("buscarHoras", () => {
  it("descarta horas com null e manda timezone=auto", async () => {
    const f = vi.fn(() => resp({ utc_offset_seconds: -10800, hourly: { time: ["2026-11-25T07:00", "2026-11-25T08:00"], temperature_2m: [25, null], precipitation: [0, 0], weather_code: [0, 0] } }));
    vi.stubGlobal("fetch", f);
    const r = await buscarHoras(-22, -41, "2026-11-25", "2026-11-25");
    expect(r!.horas).toHaveLength(1);
    expect(r!.utcOffsetSeconds).toBe(-10800);
    const url = String((f.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("timezone=auto");
    expect(url).toContain("start_date=2026-11-25");
  });
  it("falha de rede ⇒ null", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("fora"))));
    expect(await buscarHoras(-22, -41, "2026-11-25", "2026-11-25")).toBeNull();
  });
  it("HTTP 500 ⇒ null", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(() => resp({}, 500)));
    expect(await buscarHoras(-22, -41, "2026-11-25", "2026-11-25")).toBeNull();
  });
});

describe("buscarCidades", () => {
  it("menos de 2 letras não chama", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await buscarCidades("M")).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });
  it("monta o nome com o estado", async () => {
    vi.stubGlobal("fetch", vi.fn(() => resp({ results: [{ name: "Macaé", admin1: "Rio de Janeiro", latitude: -22.37, longitude: -41.79 }] })));
    expect((await buscarCidades("Macaé"))[0].nome).toBe("Macaé, Rio de Janeiro");
  });
  it("sem results ⇒ []", async () => {
    vi.stubGlobal("fetch", vi.fn(() => resp({})));
    expect(await buscarCidades("Xyzw")).toEqual([]);
  });
});

describe("obterClimaTurno", () => {
  it("sem coordenadas não chama", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await obterClimaTurno({ latitude: null, longitude: null }, turno)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
  it("noturno pede o dia seguinte", async () => {
    const f = vi.fn(() => resp({ utc_offset_seconds: 0, hourly: { time: [], temperature_2m: [], precipitation: [], weather_code: [] } }));
    vi.stubGlobal("fetch", f);
    await obterClimaTurno({ latitude: -22, longitude: -41 }, { ...turno, hora_inicio_prevista: "19:00:00", hora_fim_prevista: "05:00:00" });
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain("end_date=2026-11-26");
  });
});

describe("modo falso", () => {
  it("cidades e clima determinísticos", async () => {
    vi.stubEnv("FRENTIA_CLIMA_FALSO", "1");
    expect((await buscarCidades("maca"))[0].nome).toBe("Macaé, Rio de Janeiro");
    const c = await obterClimaTurno({ latitude: -22.37, longitude: -41.79 }, turno, { agora: new Date("2026-11-26T12:00:00Z") });
    expect(c!.choveu).toBe(true);
    expect(c!.leituras).toHaveLength(6);
  });
});
