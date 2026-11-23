import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adicionarAtividade } from "@/lib/db/atividades";
import { lancarExtraCampo, obterTurnoPorToken } from "@/lib/db/campo";
import { criarObra } from "@/lib/db/obras";
import { criarRascunho, programarSemana, salvarAtividadeProgramada } from "@/lib/db/programacao";
import { entradaDoTurno } from "@/lib/db/quadro";
import { criarResponsavel } from "@/lib/db/responsaveis";
import { aplicarAcao, criarTurno, obterTurnoCompleto } from "@/lib/db/turnos";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

describe.skipIf(!ligado)("equipe prevista da atividade", () => {
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

  it("avulsa grava a própria equipe; programada lê a da programação; quadro também", { timeout: 90_000 }, async () => {
    const obra = exigir(await criarObra(u.cliente, { nome: "Obra Equipe" }));
    const ana = exigir(await criarResponsavel(u.cliente, obra.id, { nome: "Ana Souza" })).id;
    const semana = exigir(await criarRascunho(u.cliente, obra.id, "2026-11-16"));
    exigir(await salvarAtividadeProgramada(u.cliente, semana.id, {
      descricao: "Solda", unidade: "jt", meta: 10, dias: [2], periodo: "diurno",
      equipe: [{ funcao: "Soldador", quantidade: 2 }], responsavel_id: ana,
    }));
    exigir(await programarSemana(u.cliente, semana.id));
    const t = exigir(await criarTurno(u.cliente, { obra_id: obra.id, data: "2026-11-18", periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00" }));
    const avulsa = exigir(await adicionarAtividade(u.cliente, t.id, {
      descricao: "Limpeza", unidade: "un", qtd_planejada: 1, responsavel_id: ana, equipe: [{ funcao: "Ajudante", quantidade: 1 }],
    }));
    expect(avulsa.responsavel_id).toBe(ana);
    expect(avulsa.equipe).toEqual([{ funcao: "Ajudante", quantidade: 1 }]);
    const turno = await obterTurnoCompleto(u.cliente, t.id);
    expect(turno?.atividades.find((a) => a.descricao === "Solda")?.equipe).toEqual([{ funcao: "Soldador", quantidade: 2 }]);
    const quadro = await entradaDoTurno(criarClienteAdmin(), t.id);
    expect(quadro?.atividades.find((a) => a.descricao === "Limpeza")?.equipe).toEqual([{ funcao: "Ajudante", quantidade: 1 }]);

    expect(await adicionarAtividade(u.cliente, t.id, { descricao: "X", unidade: "un", qtd_planejada: 1, equipe: [{ funcao: "", quantidade: 1 }] }))
      .toMatchObject({ ok: false, erro: "Informe a função de cada linha da equipe" });
  });

  it("extra do campo grava a equipe na atividade do responsável do link", { timeout: 90_000 }, async () => {
    const obra = exigir(await criarObra(u.cliente, { nome: "Obra Extra Equipe" }));
    const rita = exigir(await criarResponsavel(u.cliente, obra.id, { nome: "Rita Alves" })).id;
    const t = exigir(await criarTurno(u.cliente, { obra_id: obra.id, data: "2026-11-18", periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00" }));
    exigir(await adicionarAtividade(u.cliente, t.id, { descricao: "Base", unidade: "un", qtd_planejada: 1, responsavel_id: rita }));
    const l = exigir(await aplicarAcao(u.cliente, t.id, "liberar")) as { token: string };
    const id = crypto.randomUUID();
    exigir(await lancarExtraCampo(l.token, { id, descricao: "Reparo", unidade: "un", qtd: 1, equipe: [{ funcao: "Eletricista", quantidade: 2 }] }, rita));
    const turno = await obterTurnoPorToken(l.token);
    const extra = turno?.atividades.find((a) => a.id === id);
    expect(extra?.responsavel_id).toBe(rita);
    expect(extra?.equipe).toEqual([{ funcao: "Eletricista", quantidade: 2 }]);
  });
});
