import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adicionarAtividade, confirmarAtividade, definirResponsavel, editarAtividade, removerAtividade } from "@/lib/db/atividades";
import { criarObra } from "@/lib/db/obras";
import { criarResponsavel } from "@/lib/db/responsaveis";
import { aplicarAcao, criarTurno, obterTurnoCompleto } from "@/lib/db/turnos";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

describe.skipIf(!ligado)("confirmar atividade no turno planejado", () => {
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

  it("efetivo = soma das equipes confirmadas; editar desconfirma; trocar/remover recalcula", { timeout: 120_000 }, async () => {
    const obra = exigir(await criarObra(u.cliente, { nome: "Obra Confirmar" }));
    const ana = exigir(await criarResponsavel(u.cliente, obra.id, { nome: "Ana Souza" })).id;
    const beto = exigir(await criarResponsavel(u.cliente, obra.id, { nome: "Beto Lima" })).id;
    const t = exigir(await criarTurno(u.cliente, { obra_id: obra.id, data: "2026-11-18", periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00" }));
    const a1 = exigir(await adicionarAtividade(u.cliente, t.id, { descricao: "Andaime 1", unidade: "m", qtd_planejada: 5, responsavel_id: ana, equipe: [{ funcao: "Montador", quantidade: 4 }] }));
    const a2 = exigir(await adicionarAtividade(u.cliente, t.id, { descricao: "Andaime 2", unidade: "m", qtd_planejada: 5, responsavel_id: ana, equipe: [{ funcao: "montador ", quantidade: 2 }, { funcao: "Ajudante", quantidade: 1 }] }));
    const efetivo = async (resp: string) =>
      ((await obterTurnoCompleto(u.cliente, t.id))?.efetivo ?? [])
        .filter((e) => e.responsavel_id === resp)
        .map((e) => ({ funcao: e.funcao, quantidade: e.quantidade }));

    exigir(await confirmarAtividade(u.cliente, a1.id));
    expect(await efetivo(ana)).toEqual([{ funcao: "Montador", quantidade: 4 }]);
    exigir(await confirmarAtividade(u.cliente, a2.id));
    expect(await efetivo(ana)).toEqual([{ funcao: "Montador", quantidade: 6 }, { funcao: "Ajudante", quantidade: 1 }]);
    const turno = await obterTurnoCompleto(u.cliente, t.id);
    expect(turno?.atividades.every((a) => a.equipe_confirmada)).toBe(true);

    // Editar a equipe desfaz a confirmação e tira a equipe da soma até confirmar de novo.
    exigir(await editarAtividade(u.cliente, a2.id, { equipe: [{ funcao: "Ajudante", quantidade: 3 }] }));
    expect(await efetivo(ana)).toEqual([{ funcao: "Montador", quantidade: 4 }]);
    exigir(await confirmarAtividade(u.cliente, a2.id));
    expect(await efetivo(ana)).toEqual([{ funcao: "Montador", quantidade: 4 }, { funcao: "Ajudante", quantidade: 3 }]);

    // Trocar o responsável leva a equipe junto.
    exigir(await definirResponsavel(u.cliente, a1.id, beto));
    expect(await efetivo(ana)).toEqual([{ funcao: "Ajudante", quantidade: 3 }]);
    expect(await efetivo(beto)).toEqual([{ funcao: "Montador", quantidade: 4 }]);

    exigir(await removerAtividade(u.cliente, a1.id));
    expect(await efetivo(beto)).toEqual([]);

    // Depois de liberado: Confirmar é recusado.
    exigir(await aplicarAcao(u.cliente, t.id, "liberar"));
    expect(await confirmarAtividade(u.cliente, a2.id)).toMatchObject({ ok: false });
  });
});
