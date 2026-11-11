import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adicionarAtividade } from "@/lib/db/atividades";
import { enviarTurnoCampo } from "@/lib/db/campo";
import { salvarExecucaoPlanejador } from "@/lib/db/execucao";
import { listarEventos } from "@/lib/db/eventos";
import { criarObra } from "@/lib/db/obras";
import { aplicarAcao, criarTurno, gerarNovoLink } from "@/lib/db/turnos";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

type Evento = { id: string; tipo: string; ator_tipo: string; ator_nome: string | null; versao: number | null; motivo: string | null };

describe.skipIf(!ligado)("turno_eventos no banco", () => {
  let u: UsuarioTeste;
  let outro: UsuarioTeste;
  beforeAll(async () => {
    u = await criarUsuarioTeste();
    outro = await criarUsuarioTeste();
  });
  afterAll(async () => {
    if (u) await removerUsuarioTeste(u.userId);
    if (outro) await removerUsuarioTeste(outro.userId);
  });

  const exigir = <T,>(r: { ok: true; dados: T } | { ok: false; erro: string }): T => {
    if (!r.ok) throw new Error(r.erro);
    return r.dados;
  };

  /** Obra própria + turno liberado, com atividade executada (pronto para enviar/fechar). */
  async function turnoLiberado() {
    const obra = exigir(await criarObra(u.cliente, { nome: "Obra Eventos" }));
    const t = exigir(await criarTurno(u.cliente, {
      obra_id: obra.id, data: "2026-11-10", periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "16:00",
    }));
    const at = exigir(await adicionarAtividade(u.cliente, t.id, { descricao: "Forma", unidade: "m²", qtd_planejada: 10 }));
    exigir(await aplicarAcao(u.cliente, t.id, "liberar"));
    exigir(await salvarExecucaoPlanejador(u.cliente, t.id, at.id, { qtd_realizada: 4, causa: "material", observacao: "x" }));
    return { turnoId: t.id };
  }

  async function eventos(turnoId: string): Promise<Evento[]> {
    const { data, error } = await criarClienteAdmin()
      .from("turno_eventos").select("id, tipo, ator_tipo, ator_nome, versao, motivo").eq("turno_id", turnoId)
      .order("em").order("id");
    if (error) throw new Error(error.message);
    return data as Evento[];
  }

  async function motivoDaFoto(turnoId: string, numero: number) {
    const { data, error } = await criarClienteAdmin()
      .from("rdo_versoes").select("dados").eq("turno_id", turnoId).eq("numero", numero).single();
    if (error) throw new Error(error.message);
    return (data.dados as { turno: { motivo_reabertura?: string | null } }).turno.motivo_reabertura ?? null;
  }

  it("ciclo completo registra os marcos na ordem", { timeout: 90_000 }, async () => {
    const { turnoId } = await turnoLiberado();
    const { token } = exigir(await gerarNovoLink(u.cliente, turnoId));
    exigir(await enviarTurnoCampo(token));
    exigir(await aplicarAcao(u.cliente, turnoId, "fechar"));
    exigir(await aplicarAcao(u.cliente, turnoId, "reabrir", { motivo: "  Corrigir quantidade  " }));
    exigir(await aplicarAcao(u.cliente, turnoId, "fechar"));

    const es = await eventos(turnoId);
    expect(es.map((e) => e.tipo)).toEqual(["criado", "liberado", "novo_link", "enviado", "fechado", "reaberto", "fechado"]);
    const enviado = es[3];
    expect(enviado).toMatchObject({ ator_tipo: "encarregado", ator_nome: null });
    for (const e of es.filter((x) => x.tipo !== "enviado")) {
      expect(e).toMatchObject({ ator_tipo: "planejador", ator_nome: u.email });
    }
    expect(es.filter((e) => e.tipo === "fechado").map((e) => e.versao)).toEqual([1, 2]);
    expect(es[5].motivo).toBe("Corrigir quantidade");
    expect(es.filter((e) => e.tipo !== "fechado").every((e) => e.versao === null)).toBe(true);

    expect(await motivoDaFoto(turnoId, 1)).toBeNull();
    expect(await motivoDaFoto(turnoId, 2)).toBe("Corrigir quantidade");

    const lidos = await listarEventos(u.cliente, turnoId);
    expect(lidos.map((e) => e.tipo)).toEqual(es.map((e) => e.tipo));
    expect(lidos[3]).toMatchObject({ atorTipo: "encarregado", atorNome: null });
    expect(lidos[4]).toMatchObject({ atorTipo: "planejador", atorNome: u.email, versao: 1 });
    expect(lidos[5].motivo).toBe("Corrigir quantidade");
    expect(await listarEventos(outro.cliente, turnoId)).toEqual([]);
    expect(await listarEventos(u.cliente, "xyz")).toEqual([]);
  });

  it("reabrir duas vezes: v3 com o 2º motivo", { timeout: 90_000 }, async () => {
    const { turnoId } = await turnoLiberado();
    exigir(await aplicarAcao(u.cliente, turnoId, "fechar"));
    exigir(await aplicarAcao(u.cliente, turnoId, "reabrir", { motivo: "Primeiro" }));
    exigir(await aplicarAcao(u.cliente, turnoId, "fechar"));
    exigir(await aplicarAcao(u.cliente, turnoId, "reabrir", { motivo: "Segundo ajuste" }));
    exigir(await aplicarAcao(u.cliente, turnoId, "fechar"));
    const es = await eventos(turnoId);
    expect(es.filter((e) => e.tipo === "reaberto").map((e) => e.motivo)).toEqual(["Primeiro", "Segundo ajuste"]);
    expect(await motivoDaFoto(turnoId, 3)).toBe("Segundo ajuste");
  });

  it("banco recusa reabrir sem motivo", { timeout: 60_000 }, async () => {
    const { turnoId } = await turnoLiberado();
    exigir(await aplicarAcao(u.cliente, turnoId, "fechar"));
    const sem = await u.cliente.from("turnos").update({ status: "enviado", fechado_em: null }).eq("id", turnoId);
    expect(sem.error?.message).toBe("motivo_obrigatorio");
    const espacos = await u.cliente.from("turnos").update({ status: "enviado", fechado_em: null, motivo_reabertura: "   " }).eq("id", turnoId);
    expect(espacos.error?.message).toBe("motivo_obrigatorio");
    const { data } = await u.cliente.from("turnos").select("status").eq("id", turnoId).single();
    expect(data!.status).toBe("fechado");
  });

  it("aplicarAcao valida o motivo", { timeout: 60_000 }, async () => {
    const { turnoId } = await turnoLiberado();
    exigir(await aplicarAcao(u.cliente, turnoId, "fechar"));
    expect(await aplicarAcao(u.cliente, turnoId, "reabrir")).toEqual({ ok: false, erro: "Informe o motivo da reabertura" });
    expect(await aplicarAcao(u.cliente, turnoId, "reabrir", { motivo: "ab" })).toEqual({ ok: false, erro: "Informe o motivo da reabertura" });
    expect(await aplicarAcao(u.cliente, turnoId, "reabrir", { motivo: "x".repeat(501) })).toEqual({
      ok: false, erro: "O motivo pode ter até 500 caracteres",
    });
  });

  it("o app não grava nem apaga eventos", { timeout: 60_000 }, async () => {
    const { turnoId } = await turnoLiberado();
    const [primeiro] = await eventos(turnoId);
    expect((await u.cliente.from("turno_eventos").insert({ turno_id: turnoId, obra_id: turnoId, tipo: "criado", ator_tipo: "planejador" })).error).not.toBeNull();
    expect((await u.cliente.from("turno_eventos").update({ motivo: "x" }).eq("id", primeiro.id)).error).not.toBeNull();
    expect((await u.cliente.from("turno_eventos").delete().eq("id", primeiro.id)).error).not.toBeNull();
    expect((await eventos(turnoId))[0]).toEqual(primeiro);
  });

  it("outra empresa não lê eventos", { timeout: 60_000 }, async () => {
    const { turnoId } = await turnoLiberado();
    expect((await u.cliente.from("turno_eventos").select("id").eq("turno_id", turnoId)).data!.length).toBeGreaterThan(0);
    expect((await outro.cliente.from("turno_eventos").select("id").eq("turno_id", turnoId)).data).toEqual([]);
  });
});
