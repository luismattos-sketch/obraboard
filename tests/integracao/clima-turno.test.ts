import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { adicionarAtividade } from "@/lib/db/atividades";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarObra } from "@/lib/db/obras";
import { aplicarAcao, criarTurno, obterTurnoCompleto } from "@/lib/db/turnos";
import { salvarExecucaoPlanejador } from "@/lib/db/execucao";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, VAZIO, type UsuarioTeste } from "./ajuda";

describe.skipIf(!ligado)("clima automático do turno", () => {
  let u: UsuarioTeste;
  beforeAll(async () => {
    u = await criarUsuarioTeste();
  });
  afterAll(async () => {
    if (u) await removerUsuarioTeste(u.userId);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function cenario(comCidade = true, data = "2026-11-20") {
    const o = await criarObra(u.cliente, { nome: "Obra Clima" });
    if (!o.ok) throw new Error(o.erro);
    if (comCidade) {
      const { error } = await criarClienteAdmin().from("obras").update({ local_nome: "Macaé, Rio de Janeiro", latitude: -22.37, longitude: -41.79 }).eq("id", o.dados.id);
      if (error) throw new Error(error.message);
    }
    const t = await criarTurno(u.cliente, { obra_id: o.dados.id, data, periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00" });
    if (!t.ok) throw new Error(t.erro);
    const a = await adicionarAtividade(u.cliente, t.dados.id, { descricao: "Tubo", unidade: "m", qtd_planejada: 10 });
    if (!a.ok) throw new Error(a.erro);
    const l = await aplicarAcao(u.cliente, t.dados.id, "liberar");
    if (!l.ok) throw new Error(l.erro);
    const e = await salvarExecucaoPlanejador(u.cliente, t.dados.id, a.dados.id, { qtd_realizada: 10, causa: null, observacao: null }, VAZIO);
    if (!e.ok) throw new Error(e.erro);
    return t.dados.id;
  }
  const ultimaFoto = async (turnoId: string) => {
    const { data } = await u.cliente.from("rdo_versoes").select("dados").eq("turno_id", turnoId).order("numero", { ascending: false }).limit(1).single();
    return data!.dados as Record<string, unknown>;
  };

  it("enviar grava o clima; fechar leva ao retrato do RDO", { timeout: 60_000 }, async () => {
    vi.stubEnv("FRENTIA_CLIMA_FALSO", "1");
    const id = await cenario();
    expect((await aplicarAcao(u.cliente, id, "enviar")).ok).toBe(true);
    const t = await obterTurnoCompleto(u.cliente, id);
    expect(t!.clima_turno!.leituras).toHaveLength(6);
    expect(t!.clima_turno!.choveu).toBe(true);
    expect(t!.obra.local_nome).toBe("Macaé, Rio de Janeiro");
    expect((await aplicarAcao(u.cliente, id, "fechar")).ok).toBe(true);
    const foto = await ultimaFoto(id);
    expect((foto.clima_turno as { leituras: unknown[] }).leituras).toHaveLength(6);
    expect(foto).not.toHaveProperty("clima");
  });

  it("obra sem cidade: fecha e o retrato fica sem clima", { timeout: 60_000 }, async () => {
    vi.stubEnv("FRENTIA_CLIMA_FALSO", "1");
    const id = await cenario(false);
    expect((await aplicarAcao(u.cliente, id, "fechar")).ok).toBe(true);
    expect((await ultimaFoto(id)).clima_turno).toBeNull();
  });

  it("serviço fora do ar não impede fechar", { timeout: 60_000 }, async () => {
    const id = await cenario();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const real = globalThis.fetch;
    vi.stubGlobal("fetch", (url: RequestInfo | URL, init?: RequestInit) =>
      String(url).includes("open-meteo") ? Promise.reject(new Error("fora")) : real(url, init));
    expect((await aplicarAcao(u.cliente, id, "fechar")).ok).toBe(true);
    expect((await ultimaFoto(id)).clima_turno).toBeNull();
  });

  it("enviar no meio do turno grava só até agora", { timeout: 60_000 }, async () => {
    vi.stubEnv("FRENTIA_CLIMA_FALSO", "1");
    const id = await cenario(true, "2026-11-25");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-25T17:10:00Z")); // 14:10 em Macaé
    expect((await aplicarAcao(u.cliente, id, "enviar")).ok).toBe(true);
    vi.useRealTimers();
    const t = await obterTurnoCompleto(u.cliente, id);
    expect(t!.clima_turno!.leituras.at(-1)!.hora).toBe("2026-11-25T14:00");
  });

  it("turno fechado não aceita escrita no clima", { timeout: 60_000 }, async () => {
    vi.stubEnv("FRENTIA_CLIMA_FALSO", "1");
    const id = await cenario();
    expect((await aplicarAcao(u.cliente, id, "fechar")).ok).toBe(true);
    const { error } = await u.cliente.from("clima_turno").update({ choveu: false }).eq("turno_id", id);
    expect(error?.message).toContain("turno_fechado");
  });
});
