import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  criarClienteAnon,
  criarUsuarioTeste,
  ligado,
  removerUsuarioTeste,
  type UsuarioTeste,
} from "./ajuda";

describe.skipIf(!ligado)("RLS", () => {
  let a: UsuarioTeste;
  let b: UsuarioTeste;
  let obraA: string;
  let turnoA: string;

  beforeAll(async () => {
    a = await criarUsuarioTeste();
    b = await criarUsuarioTeste();
    const { data, error } = await a.cliente
      .from("obras")
      .insert({ empresa_id: a.empresaId, nome: "Obra A" })
      .select("id")
      .single();
    expect(error).toBeNull();
    obraA = data!.id;
    const t = await a.cliente
      .from("turnos")
      .insert({ obra_id: obraA, data: "2026-11-10", periodo: "diurno" })
      .select("id")
      .single();
    expect(t.error).toBeNull();
    turnoA = t.data!.id;
  });

  afterAll(async () => {
    if (a) await removerUsuarioTeste(a.userId);
    if (b) await removerUsuarioTeste(b.userId);
  });

  it("usuário B não enxerga obras de A", async () => {
    const { data, error } = await b.cliente.from("obras").select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("usuário B não consegue inserir turno na obra de A", async () => {
    const { error } = await b.cliente
      .from("turnos")
      .insert({ obra_id: obraA, data: "2026-11-11", periodo: "diurno" });
    expect(error).not.toBeNull();
  });

  it("usuário B não consegue inserir obra na empresa de A", async () => {
    const { error } = await b.cliente
      .from("obras")
      .insert({ empresa_id: a.empresaId, nome: "Invasora" });
    expect(error).not.toBeNull();
  });

  it("anon não lê obras", async () => {
    const { data } = await criarClienteAnon().from("obras").select("*");
    expect(data ?? []).toEqual([]);
  });

  it("A só vê o próprio vínculo e a própria empresa", async () => {
    const m = await a.cliente.from("membros").select("user_id");
    expect(m.data).toEqual([{ user_id: a.userId }]);
    const e = await a.cliente.from("empresas").select("id");
    expect(e.data).toEqual([{ id: a.empresaId }]);
  });

  it("qtd_planejada 0 viola o check", async () => {
    const { error } = await a.cliente
      .from("atividades")
      .insert({ turno_id: turnoA, ordem: 1, descricao: "X", qtd_planejada: 0 });
    expect(error).not.toBeNull();
  });

  it("B não consegue inserir atividade no turno de A", async () => {
    const { error } = await b.cliente
      .from("atividades")
      .insert({ turno_id: turnoA, ordem: 1, descricao: "X", qtd_planejada: 1 });
    expect(error).not.toBeNull();
  });

  it("turno duplicado (obra, data, período) retorna 23505", async () => {
    const { error } = await a.cliente
      .from("turnos")
      .insert({ obra_id: obraA, data: "2026-11-10", periodo: "diurno" });
    expect(error?.code).toBe("23505");
  });
});
