import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adicionarAtividade, definirResponsavel } from "@/lib/db/atividades";
import { salvarEfetivoPlanejador, salvarExecucaoPlanejador } from "@/lib/db/execucao";
import { ERRO_FECHADO_PLANEJADOR, ERRO_RESPONSAVEL_INVALIDO } from "@/lib/db/mensagens";
import { criarObra } from "@/lib/db/obras";
import { criarResponsavel } from "@/lib/db/responsaveis";
import { aplicarAcao, criarTurno, obterTurnoCompleto } from "@/lib/db/turnos";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

describe.skipIf(!ligado)("turno por responsável", () => {
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

  async function cenario() {
    const obra = exigir(await criarObra(u.cliente, { nome: "Obra Turno Resp" }));
    const ana = exigir(await criarResponsavel(u.cliente, obra.id, { nome: "Ana" }));
    const bruno = exigir(await criarResponsavel(u.cliente, obra.id, { nome: "Bruno" }));
    const t = exigir(await criarTurno(u.cliente, {
      obra_id: obra.id, data: "2026-11-10", periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "16:00",
    }));
    const at = exigir(await adicionarAtividade(u.cliente, t.id, { descricao: "Forma", unidade: "m²", qtd_planejada: 10 }));
    return { obraId: obra.id, ana: ana.id, bruno: bruno.id, turnoId: t.id, atividadeId: at.id };
  }

  it("definir responsável", { timeout: 60_000 }, async () => {
    const c = await cenario();
    expect(await definirResponsavel(u.cliente, c.atividadeId, c.ana)).toEqual({ ok: true, dados: undefined });
    exigir(await aplicarAcao(u.cliente, c.turnoId, "liberar"));
    expect((await definirResponsavel(u.cliente, c.atividadeId, c.bruno)).ok).toBe(true);
    expect((await obterTurnoCompleto(u.cliente, c.turnoId))?.atividades[0].responsavel_id).toBe(c.bruno);

    const outra = await cenario();
    expect(await definirResponsavel(u.cliente, c.atividadeId, outra.ana)).toEqual({ ok: false, erro: ERRO_RESPONSAVEL_INVALIDO });

    exigir(await salvarExecucaoPlanejador(u.cliente, c.turnoId, c.atividadeId, { qtd_realizada: 10, causa: null, observacao: null }));
    exigir(await aplicarAcao(u.cliente, c.turnoId, "fechar"));
    expect(await definirResponsavel(u.cliente, c.atividadeId, null)).toEqual({ ok: false, erro: ERRO_FECHADO_PLANEJADOR });
  });

  it("efetivo do planejador por equipe, também no turno planejado", { timeout: 60_000 }, async () => {
    const c = await cenario();
    exigir(await salvarEfetivoPlanejador(u.cliente, c.turnoId, c.ana, [{ funcao: "Pedreiro", quantidade: 2 }], []));
    exigir(await salvarEfetivoPlanejador(u.cliente, c.turnoId, c.bruno, [{ funcao: "Servente", quantidade: 1 }], []));
    exigir(await salvarEfetivoPlanejador(u.cliente, c.turnoId, c.ana, [{ funcao: "Pedreiro", quantidade: 3 }], [{ funcao: "Pedreiro", quantidade: 2 }]));
    const ef = (await obterTurnoCompleto(u.cliente, c.turnoId))!.efetivo.map((e) => [e.funcao, e.quantidade, e.responsavel_id]);
    expect(ef).toHaveLength(2);
    expect(ef).toContainEqual(["Pedreiro", 3, c.ana]);
    expect(ef).toContainEqual(["Servente", 1, c.bruno]);
  });
});
