import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarObra } from "@/lib/db/obras";
import { aplicarAcao, criarTurno, obterTurnoCompleto } from "@/lib/db/turnos";
import { adicionarAtividade } from "@/lib/db/atividades";
import { salvarEfetivo } from "@/lib/db/campo";
import {
  criarOcorrenciaCampo,
  criarOcorrenciaPlanejador,
  removerOcorrenciaCampo,
  removerOcorrenciaPlanejador,
} from "@/lib/db/ocorrencias";
import type { DadosOcorrencia } from "@/lib/db/validacao";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

describe.skipIf(!ligado)("ocorrências do efetivo", () => {
  let u: UsuarioTeste;
  beforeAll(async () => {
    u = await criarUsuarioTeste();
  });
  afterAll(async () => {
    if (u) await removerUsuarioTeste(u.userId);
  });

  async function responsavel(obraId: string, nome: string): Promise<string> {
    const { data, error } = await u.cliente.from("responsaveis").insert({ obra_id: obraId, nome }).select("id").single();
    if (error || !data) throw new Error(`responsavel: ${error?.message}`);
    return data.id as string;
  }
  async function cenario() {
    const o = await criarObra(u.cliente, { nome: "Obra Ocorrências" });
    if (!o.ok) throw new Error(o.erro);
    const t = await criarTurno(u.cliente, {
      obra_id: o.dados.id, data: "2026-11-16", periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00",
    });
    if (!t.ok) throw new Error(t.erro);
    const a = await adicionarAtividade(u.cliente, t.dados.id, { descricao: "Andaime", unidade: "m³", qtd_planejada: 10 });
    if (!a.ok) throw new Error(a.erro);
    const rita = await responsavel(o.dados.id, "Rita");
    const ana = await responsavel(o.dados.id, "Ana");
    const outro = await responsavel(o.dados.id, "Outro");
    const l = await aplicarAcao(u.cliente, t.dados.id, "liberar");
    if (!l.ok || !l.dados.token) throw new Error("liberar");
    const token = l.dados.token;
    const e = await salvarEfetivo(token, [{ funcao: "Montador de andaime", quantidade: 6 }], [], rita);
    if (!e.ok) throw new Error(e.erro);
    return { turnoId: t.dados.id, token, rita, ana, outro };
  }
  const emprestimo = (destino: string, extra: Partial<DadosOcorrencia> = {}): DadosOcorrencia => ({
    id: randomUUID(), tipo: "emprestimo", funcao: "montador de andaime", quantidade: 2, hora_inicio: "13:00", hora_fim: null,
    destino_responsavel_id: destino, emprestimo_id: null, causa: null, ...extra,
  });
  const parado = (extra: Partial<DadosOcorrencia> = {}): DadosOcorrencia => ({
    id: randomUUID(), tipo: "parado", funcao: "Montador de andaime", quantidade: 1, hora_inicio: "14:00", hora_fim: "15:00",
    destino_responsavel_id: null, emprestimo_id: null, causa: "material", ...extra,
  });

  it("criar duas vezes o mesmo id não duplica; grava a grafia da linha", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const d = emprestimo(c.ana);
    expect(await criarOcorrenciaCampo(c.token, d, c.rita)).toEqual({ ok: true, dados: undefined });
    expect(await criarOcorrenciaCampo(c.token, d, c.rita)).toEqual({ ok: true, dados: undefined });
    const t = await obterTurnoCompleto(u.cliente, c.turnoId);
    expect(t?.ocorrencias).toHaveLength(1);
    expect(t?.ocorrencias[0]).toMatchObject({ funcao: "Montador de andaime", responsavel_id: c.rita, destino_responsavel_id: c.ana });
  });

  it("reenvio de registro já gravado é sucesso mesmo se a linha mudou depois", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const d = parado();
    expect((await criarOcorrenciaCampo(c.token, d, c.rita)).ok).toBe(true);
    const e = await salvarEfetivo(c.token, [{ funcao: "Montador", quantidade: 6 }], [{ funcao: "Montador de andaime", quantidade: 6 }], c.rita);
    expect(e.ok).toBe(true);
    expect(await criarOcorrenciaCampo(c.token, d, c.rita)).toEqual({ ok: true, dados: undefined });
  });

  it("mesmo id com dados diferentes é recusado", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const d = emprestimo(c.ana);
    await criarOcorrenciaCampo(c.token, d, c.rita);
    expect((await criarOcorrenciaCampo(c.token, { ...d, quantidade: 3 }, c.rita)).ok).toBe(false);
  });

  it("remover já removida é sucesso", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const d = parado();
    await criarOcorrenciaCampo(c.token, d, c.rita);
    expect((await removerOcorrenciaCampo(c.token, d.id, c.rita)).ok).toBe(true);
    expect((await removerOcorrenciaCampo(c.token, d.id, c.rita)).ok).toBe(true);
    expect((await obterTurnoCompleto(u.cliente, c.turnoId))?.ocorrencias).toEqual([]);
  });

  it("campo não remove ocorrência de outra equipe", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const d = parado();
    await criarOcorrenciaCampo(c.token, d, c.rita);
    await removerOcorrenciaCampo(c.token, d.id, c.ana);
    expect((await obterTurnoCompleto(u.cliente, c.turnoId))?.ocorrencias).toHaveLength(1);
  });

  it("campo não lança parado em empréstimo de outra equipe", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const emp = emprestimo(c.ana);
    await criarOcorrenciaCampo(c.token, emp, c.rita);
    const r = await criarOcorrenciaCampo(c.token, parado({ emprestimo_id: emp.id }), c.outro);
    expect(r.ok).toBe(false);
    const ok = await criarOcorrenciaCampo(c.token, parado({ emprestimo_id: emp.id, funcao: "qualquer" }), c.ana);
    expect(ok.ok).toBe(true);
    const t = await obterTurnoCompleto(u.cliente, c.turnoId);
    expect(t?.ocorrencias.find((o) => o.emprestimo_id === emp.id)?.funcao).toBe("Montador de andaime");
  });

  it("campo não empresta para si", { timeout: 60_000 }, async () => {
    const c = await cenario();
    expect((await criarOcorrenciaCampo(c.token, emprestimo(c.rita), c.rita)).ok).toBe(false);
  });

  it("função inexistente na equipe é recusada", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const r = await criarOcorrenciaCampo(c.token, parado({ funcao: "Pintor" }), c.rita);
    expect(r).toMatchObject({ ok: false, erro: "Adicione a função no efetivo antes." });
  });

  it("planejador cria e remove; obterTurnoCompleto traz intervalo", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const d = emprestimo(c.ana);
    expect((await criarOcorrenciaPlanejador(u.cliente, c.turnoId, c.rita, d)).ok).toBe(true);
    const t = await obterTurnoCompleto(u.cliente, c.turnoId);
    expect(t?.ocorrencias).toHaveLength(1);
    expect(t?.intervalo_inicio).toBe("12:00:00");
    expect((await removerOcorrenciaPlanejador(u.cliente, c.turnoId, d.id)).ok).toBe(true);
    expect((await obterTurnoCompleto(u.cliente, c.turnoId))?.ocorrencias).toEqual([]);
  });
});
