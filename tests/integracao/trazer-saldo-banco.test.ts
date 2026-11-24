import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarObra } from "@/lib/db/obras";
import {
  criarRascunho,
  obterDadosSemana,
  programarSemana,
  removerAtividadeProgramada,
  salvarAtividadeProgramada,
  trazerDaProgramacao,
} from "@/lib/db/programacao";
import { criarTurno } from "@/lib/db/turnos";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

// Item 1.6: semana de 09/11/2026 (origem) e de 16/11/2026 (trazida).
describe.skipIf(!ligado)("trazer saldo da semana anterior — banco", () => {
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
  const base = { descricao: "Pintura do galpão", unidade: "m²", meta: 120, dias: [0 as const, 1 as const], periodo: "diurno" as const, equipe: [] };

  async function cenario(nome = "Obra Trazer") {
    const obra = exigir(await criarObra(u.cliente, { nome }));
    const anterior = exigir(await criarRascunho(u.cliente, obra.id, "2026-11-09"));
    const origem = exigir(await salvarAtividadeProgramada(u.cliente, anterior.id, base)).id;
    const atual = exigir(await criarRascunho(u.cliente, obra.id, "2026-11-16"));
    return { obraId: obra.id, anterior, origem, atual };
  }

  it("grava trazida_de e saldo_trazido na inclusão", { timeout: 60_000 }, async () => {
    const { origem, atual } = await cenario();
    const id = exigir(await salvarAtividadeProgramada(u.cliente, atual.id, { ...base, meta: 8, trazida_de: origem, saldo_trazido: 8 })).id;
    const dados = await obterDadosSemana(u.cliente, atual);
    expect(dados.atividades.find((a) => a.id === id)).toMatchObject({ trazida_de: origem, saldo_trazido: 8, meta: 8 });
  });

  it("recusa origem que não é da semana anterior", { timeout: 60_000 }, async () => {
    const { atual } = await cenario();
    const mesma = exigir(await salvarAtividadeProgramada(u.cliente, atual.id, base)).id;
    const erro = { ok: false, erro: "Só dá para trazer atividade da semana anterior desta obra." };
    expect(await salvarAtividadeProgramada(u.cliente, atual.id, { ...base, trazida_de: mesma, saldo_trazido: 1 })).toMatchObject(erro);
    const outra = await cenario("Outra obra");
    expect(await salvarAtividadeProgramada(u.cliente, atual.id, { ...base, trazida_de: outra.origem, saldo_trazido: 1 })).toMatchObject(erro);
  });

  it("recusa trazer a mesma origem duas vezes", { timeout: 60_000 }, async () => {
    const { origem, atual } = await cenario();
    exigir(await salvarAtividadeProgramada(u.cliente, atual.id, { ...base, trazida_de: origem, saldo_trazido: 120 }));
    expect(await salvarAtividadeProgramada(u.cliente, atual.id, { ...base, trazida_de: origem, saldo_trazido: 120 })).toMatchObject({
      ok: false,
      erro: "Esta atividade já foi trazida para esta semana.",
    });
  });

  it("semana programada aceita só meta = saldo_trazido em atividade trazida sem turno", { timeout: 90_000 }, async () => {
    const { obraId, anterior, origem, atual } = await cenario();
    exigir(await programarSemana(u.cliente, anterior.id));
    const id = exigir(await salvarAtividadeProgramada(u.cliente, atual.id, { ...base, trazida_de: origem, saldo_trazido: 120 })).id;
    exigir(await programarSemana(u.cliente, atual.id));
    const tabela = () => u.cliente.from("programacao_atividades");

    expect((await tabela().update({ meta: 5, saldo_trazido: 5 }).eq("id", id)).error).toBeNull();
    expect((await tabela().update({ meta: 6 }).eq("id", id)).error?.message).toBe("semana_travada");
    expect((await tabela().update({ meta: 6, saldo_trazido: 6, descricao: "Outra" }).eq("id", id)).error?.message).toBe("semana_travada");

    const t = exigir(await criarTurno(u.cliente, { obra_id: obraId, data: "2026-11-16", periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00" }));
    exigir(await trazerDaProgramacao(u.cliente, t.id));
    expect((await tabela().update({ meta: 4, saldo_trazido: 4 }).eq("id", id)).error?.message).toBe("meta_trazida_travada");
  });

  it("apagar a origem zera trazida_de", { timeout: 60_000 }, async () => {
    const { origem, atual } = await cenario();
    const id = exigir(await salvarAtividadeProgramada(u.cliente, atual.id, { ...base, trazida_de: origem, saldo_trazido: 120 })).id;
    exigir(await removerAtividadeProgramada(u.cliente, origem));
    const dados = await obterDadosSemana(u.cliente, atual);
    expect(dados.atividades.find((a) => a.id === id)?.trazida_de).toBeNull();
  });
});
