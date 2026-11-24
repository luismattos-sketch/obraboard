import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarObra } from "@/lib/db/obras";
import { aplicarAcao, criarTurno, obterTurnoCompleto } from "@/lib/db/turnos";
import { adicionarAtividade } from "@/lib/db/atividades";
import { salvarEfetivo } from "@/lib/db/campo";
import {
  criarOcorrenciaCampo,
  criarOcorrenciaPlanejador,
  encerrarAbertasDoTurno,
  fecharTurnoComParadas,
  encerrarParadaCampo,
  encerrarParadaPlanejador,
  removerOcorrenciaCampo,
  removerOcorrenciaPlanejador,
} from "@/lib/db/ocorrencias";
import type { DadosOcorrencia } from "@/lib/db/validacao";
import { ERRO_OCORRENCIA_INVALIDA, ERRO_RESPONSAVEL_INVALIDO } from "@/lib/db/mensagens";
import { salvarExecucaoPlanejador } from "@/lib/db/execucao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, VAZIO, type UsuarioTeste } from "./ajuda";

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
    // "Ver tudo" (sem responsável) também não remove a da equipe de alguém
    await removerOcorrenciaCampo(c.token, d.id, null);
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
  const aviso = (extra: Partial<DadosOcorrencia> = {}): DadosOcorrencia => parado({
    hora_inicio: "10:40", hora_fim: null, quantidade: 2, causa: "atividade_predecessora", observacao: "rolamento 6312", ...extra,
  });
  const lerParada = async (turnoId: string, id: string) =>
    (await obterTurnoCompleto(u.cliente, turnoId))?.ocorrencias.find((o) => o.id === id);

  it("parada aberta pelo campo com observação e equipe aguardada", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const d = aviso({ aguardando_responsavel_id: c.ana });
    expect(await criarOcorrenciaCampo(c.token, d, c.rita)).toEqual({ ok: true, dados: undefined });
    expect(await criarOcorrenciaCampo(c.token, d, c.rita)).toEqual({ ok: true, dados: undefined });
    expect(await lerParada(c.turnoId, d.id)).toMatchObject({ hora_fim: null, observacao: "rolamento 6312", aguardando_responsavel_id: c.ana });
  });

  it("equipe aguardada de outra obra é recusada", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const outra = await cenario();
    const r = await criarOcorrenciaCampo(c.token, aviso({ aguardando_responsavel_id: outra.ana }), c.rita);
    expect(r).toMatchObject({ ok: false, erro: ERRO_RESPONSAVEL_INVALIDO });
  });

  it("encerrar: grava, repetição é sucesso, outro horário é recusado", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const d = aviso();
    await criarOcorrenciaCampo(c.token, d, c.rita);
    expect(await encerrarParadaCampo(c.token, d.id, "13:15", c.rita)).toEqual({ ok: true, dados: undefined });
    expect((await lerParada(c.turnoId, d.id))?.hora_fim).toBe("13:15:00");
    expect((await encerrarParadaCampo(c.token, d.id, "13:15", c.rita)).ok).toBe(true);
    expect(await encerrarParadaCampo(c.token, d.id, "14:00", c.rita)).toMatchObject({ ok: false, erro: "Esta parada já foi encerrada às 13:15" });
  });

  it("encerrar antes do início é recusado", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const d = aviso();
    await criarOcorrenciaCampo(c.token, d, c.rita);
    expect(await encerrarParadaCampo(c.token, d.id, "09:00", c.rita)).toMatchObject({ ok: false, erro: "O fim deve ser depois do início" });
  });

  it("outra equipe não encerra a parada", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const d = aviso();
    await criarOcorrenciaCampo(c.token, d, c.rita);
    expect(await encerrarParadaCampo(c.token, d.id, "13:15", c.ana)).toMatchObject({ ok: false, erro: ERRO_OCORRENCIA_INVALIDA });
    expect((await lerParada(c.turnoId, d.id))?.hora_fim).toBeNull();
  });

  it("parada depois do fim previsto (sem fim real) é aceita", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const d = aviso({ hora_inicio: "17:30" });
    expect((await criarOcorrenciaCampo(c.token, d, c.rita)).ok).toBe(true);
    expect((await encerrarParadaCampo(c.token, d.id, "18:00", c.rita)).ok).toBe(true);
  });

  it("planejador encerra; fechamento encerra as abertas no fim do turno", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const a = aviso();
    const b = aviso({ hora_inicio: "11:00" });
    const z = aviso({ hora_inicio: "17:30" });
    await criarOcorrenciaCampo(c.token, a, c.rita);
    await criarOcorrenciaCampo(c.token, b, c.rita);
    await criarOcorrenciaCampo(c.token, z, c.rita);
    expect((await encerrarParadaPlanejador(u.cliente, c.turnoId, a.id, "12:00")).ok).toBe(true);
    expect((await encerrarAbertasDoTurno(u.cliente, c.turnoId, { [b.id]: "16:00" })).ok).toBe(true);
    expect((await lerParada(c.turnoId, a.id))?.hora_fim).toBe("12:00:00");
    expect((await lerParada(c.turnoId, b.id))?.hora_fim).toBe("16:00:00");
    expect((await lerParada(c.turnoId, z.id))?.hora_fim).toBe("17:30:00");
  });

  it("fechamento sem horário escolhido usa o fim do turno", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const a = aviso();
    await criarOcorrenciaCampo(c.token, a, c.rita);
    expect((await encerrarAbertasDoTurno(u.cliente, c.turnoId, {})).ok).toBe(true);
    expect((await lerParada(c.turnoId, a.id))?.hora_fim).toBe("17:00:00");
  });
  it("fechar depois de encerrar as abertas: a versão oficial traz a parada encerrada", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const a = aviso();
    await criarOcorrenciaCampo(c.token, a, c.rita);
    const t = await obterTurnoCompleto(u.cliente, c.turnoId);
    const e = await salvarExecucaoPlanejador(u.cliente, c.turnoId, t!.atividades[0].id, { qtd_realizada: 10, causa: null, observacao: null }, VAZIO);
    if (!e.ok) throw new Error(e.erro);
    expect((await encerrarAbertasDoTurno(u.cliente, c.turnoId, { [a.id]: "16:00" })).ok).toBe(true);
    expect((await aplicarAcao(u.cliente, c.turnoId, "fechar")).ok).toBe(true);
    const { data } = await criarClienteAdmin().from("rdo_versoes").select("dados").eq("turno_id", c.turnoId);
    expect(data![0].dados.ocorrencias[0]).toMatchObject({ id: a.id, hora_fim: "16:00:00", observacao: "rolamento 6312" });
  });
  it("fechamento recusado (causa pendente) não encerra as paradas abertas", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const a = aviso();
    await criarOcorrenciaCampo(c.token, a, c.rita);
    const r = await fecharTurnoComParadas(u.cliente, c.turnoId, { [a.id]: "16:00" });
    expect(r.ok).toBe(false);
    expect((await lerParada(c.turnoId, a.id))?.hora_fim).toBeNull();
  });

  it("fim inválido numa parada não encerra nenhuma", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const a = aviso();
    const b = aviso({ hora_inicio: "11:00" });
    await criarOcorrenciaCampo(c.token, a, c.rita);
    await criarOcorrenciaCampo(c.token, b, c.rita);
    expect((await encerrarAbertasDoTurno(u.cliente, c.turnoId, { [a.id]: "16:00", [b.id]: "09:00" })).ok).toBe(false);
    expect((await lerParada(c.turnoId, a.id))?.hora_fim).toBeNull();
  });

});
