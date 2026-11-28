import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { extrasDoLink, gerarLinkCiencia, linkPorCodigo, registrarCiencia, semanasDeCiencia } from "@/lib/db/ciencia";
import { ERRO_COM_CIENCIA, lancarExtraPlanejador, removerForaDoDiaPlanejador } from "@/lib/db/foraDoDia";
import { criarObra } from "@/lib/db/obras";
import { criarTurno } from "@/lib/db/turnos";
import { turnosDoRelatorio } from "@/lib/db/relatorioObra";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

describe.skipIf(!ligado)("ciência do cliente nos extras (4.3)", () => {
  let u: UsuarioTeste;
  beforeAll(async () => {
    u = await criarUsuarioTeste();
  });
  afterAll(async () => {
    if (u) await removerUsuarioTeste(u.userId);
  });
  const exigir = <T,>(r: { ok: true; dados: T } | { ok: false; erro: string }): T => {
    if (!r.ok) throw new Error(r.erro);
    return r.dados;
  };

  it("link da semana, lista, ciência e bloqueio de remoção", { timeout: 120_000 }, async () => {
    const obra = exigir(await criarObra(u.cliente, { nome: "Obra Ciência" }));
    const turno = (data: string) =>
      criarTurno(u.cliente, { obra_id: obra.id, data, periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00" });
    const qua = exigir(await turno("2026-11-18"));
    const outraSemana = exigir(await turno("2026-11-25"));
    const extra = (descricao: string) => ({ id: crypto.randomUUID(), descricao, unidade: "un", qtd: 2, observacao: null, responsavel_id: null });
    const a = extra("Troca de luminária");
    const b = extra("Reparo de calha");
    const c = extra("Fora da semana");
    exigir(await lancarExtraPlanejador(u.cliente, qua.id, { ...a, extra_pessoas: 2, extra_horas: 3 }));
    exigir(await lancarExtraPlanejador(u.cliente, qua.id, b));
    exigir(await lancarExtraPlanejador(u.cliente, outraSemana.id, c));

    expect((await gerarLinkCiencia(u.cliente, obra.id, "2026-11-18")).ok).toBe(false); // não é segunda
    const { codigo } = exigir(await gerarLinkCiencia(u.cliente, obra.id, "2026-11-16"));
    const link = (await linkPorCodigo(codigo))!;
    expect(link).toMatchObject({ obraId: obra.id, obraNome: "Obra Ciência", semana: "2026-11-16" });
    const lista = await extrasDoLink(link);
    expect(lista.map((e) => e.descricao).sort()).toEqual(["Reparo de calha", "Troca de luminária"]);
    expect(lista.find((e) => e.id === a.id)).toMatchObject({ extra_pessoas: 2, extra_horas: 3, ciencia: null });

    // Extra de outra semana é ignorado; nome obrigatório.
    expect((await registrarCiencia(codigo, [a.id], " ")).ok).toBe(false);
    expect(exigir(await registrarCiencia(codigo, [a.id, c.id], "Marcos, fiscal"))).toEqual({ registradas: 1 });
    expect(exigir(await registrarCiencia(codigo, [a.id], "Outro nome"))).toEqual({ registradas: 0 });
    const depois = await extrasDoLink(link);
    expect(depois.find((e) => e.id === a.id)!.ciencia!.nome).toBe("Marcos, fiscal");
    expect(depois.find((e) => e.id === b.id)!.ciencia).toBeNull();

    const semanas = await semanasDeCiencia(u.cliente, obra.id, "2026-11-27");
    expect(semanas).toEqual([
      { semana: "2026-11-23", extras: 1, cientes: 0, codigo: null },
      { semana: "2026-11-16", extras: 2, cientes: 1, codigo },
    ]);

    expect(await removerForaDoDiaPlanejador(u.cliente, qua.id, a.id)).toEqual({ ok: false, erro: ERRO_COM_CIENCIA });
    expect((await removerForaDoDiaPlanejador(u.cliente, qua.id, b.id)).ok).toBe(true);

    // Novo link: o antigo para de funcionar.
    const novo = exigir(await gerarLinkCiencia(u.cliente, obra.id, "2026-11-16")).codigo;
    expect(await linkPorCodigo(codigo)).toBeNull();
    expect((await registrarCiencia(codigo, [b.id], "X")).ok).toBe(false);
    expect(await linkPorCodigo(novo)).not.toBeNull();

    // 4.4: a consulta do relatório roda (turnos abertos ficam de fora).
    expect(await turnosDoRelatorio(u.cliente, obra.id, "2026-11-16", "2026-11-30")).toEqual([]);
  });
});
