import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarClienteAdmin } from "@/lib/supabase/admin";
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
  let obraB: string;

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
    const ob = await b.cliente
      .from("obras")
      .insert({ empresa_id: b.empresaId, nome: "Obra B" })
      .select("id")
      .single();
    expect(ob.error).toBeNull();
    obraB = ob.data!.id;
  });

  afterAll(async () => {
    if (a) await removerUsuarioTeste(a.userId);
    if (b) await removerUsuarioTeste(b.userId);
  });

  it("usuário B não enxerga obras de A", async () => {
    const { data, error } = await b.cliente.from("obras").select("*");
    expect(error).toBeNull();
    expect(data!.some((o) => o.id === obraA)).toBe(false);
    expect(data!.every((o) => o.empresa_id === b.empresaId)).toBe(true);
  });

  it("usuário B não consegue inserir turno na obra de A", async () => {
    const { error } = await b.cliente
      .from("turnos")
      .insert({ obra_id: obraA, data: "2026-11-11", periodo: "diurno" });
    expect(error?.code).toBe("42501");
  });

  it("usuário B não consegue inserir obra na empresa de A", async () => {
    const { error } = await b.cliente
      .from("obras")
      .insert({ empresa_id: a.empresaId, nome: "Invasora" });
    expect(error?.code).toBe("42501");
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
    expect(error?.code).toBe("23514");
  });

  it("B não consegue inserir atividade no turno de A", async () => {
    const { error } = await b.cliente
      .from("atividades")
      .insert({ turno_id: turnoA, ordem: 1, descricao: "X", qtd_planejada: 1 });
    expect(error?.code).toBe("42501");
  });

  it("turno duplicado (obra, data, período) retorna 23505", async () => {
    const { error } = await a.cliente
      .from("turnos")
      .insert({ obra_id: obraA, data: "2026-11-10", periodo: "diurno" });
    expect(error?.code).toBe("23505");
  });

  it("anon não consegue inserir obra", async () => {
    const { error } = await criarClienteAnon()
      .from("obras")
      .insert({ empresa_id: a.empresaId, nome: "Anon" });
    expect(error).not.toBeNull();
  });

  it("A não consegue mover o próprio turno para a obra de B", async () => {
    const { error, data } = await a.cliente
      .from("turnos")
      .update({ obra_id: obraB })
      .eq("id", turnoA)
      .select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
    const { data: linha } = await criarClienteAdmin()
      .from("turnos")
      .select("obra_id")
      .eq("id", turnoA)
      .single();
    expect(linha?.obra_id).toBe(obraA);
  });

  it("B não altera nem apaga a obra de A (0 linhas afetadas)", async () => {
    const up = await b.cliente
      .from("obras")
      .update({ nome: "Hackeada" })
      .eq("id", obraA)
      .select();
    expect(up.error).toBeNull();
    expect(up.data).toEqual([]);
    const del = await b.cliente.from("obras").delete().eq("id", obraA).select();
    expect(del.error).toBeNull();
    expect(del.data).toEqual([]);
    const { data: linha } = await criarClienteAdmin()
      .from("obras")
      .select("nome")
      .eq("id", obraA)
      .single();
    expect(linha?.nome).toBe("Obra A");
  });
});
