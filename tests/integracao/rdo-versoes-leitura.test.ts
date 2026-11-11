import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adicionarAtividade } from "@/lib/db/atividades";
import { salvarExecucaoPlanejador } from "@/lib/db/execucao";
import { criarObra } from "@/lib/db/obras";
import { listarVersoes, obterVersao, versoesDoTurno } from "@/lib/db/rdo-versoes";
import { aplicarAcao, criarTurno } from "@/lib/db/turnos";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

describe.skipIf(!ligado)("leitura de rdo_versoes", () => {
  let u: UsuarioTeste;
  let outro: UsuarioTeste;
  let obraId: string;
  let turnoId: string;
  beforeAll(async () => {
    u = await criarUsuarioTeste();
    outro = await criarUsuarioTeste();
    const exigir = <T,>(r: { ok: true; dados: T } | { ok: false; erro: string }): T => {
      if (!r.ok) throw new Error(r.erro);
      return r.dados;
    };
    obraId = exigir(await criarObra(u.cliente, { nome: "Obra Leitura" })).id;
    const t = exigir(await criarTurno(u.cliente, {
      obra_id: obraId, data: "2026-11-05", periodo: "noturno", hora_inicio_prevista: "19:00", hora_fim_prevista: "23:00",
    }));
    turnoId = t.id;
    const at = exigir(await adicionarAtividade(u.cliente, t.id, { descricao: "Alvenaria", unidade: "m²", qtd_planejada: 10 }));
    exigir(await aplicarAcao(u.cliente, t.id, "liberar"));
    exigir(await salvarExecucaoPlanejador(u.cliente, t.id, at.id, { qtd_realizada: 10, causa: null, observacao: null }));
    exigir(await aplicarAcao(u.cliente, t.id, "fechar"));
    exigir(await aplicarAcao(u.cliente, t.id, "reabrir"));
    exigir(await aplicarAcao(u.cliente, t.id, "fechar"));
  }, 90_000);
  afterAll(async () => {
    if (u) await removerUsuarioTeste(u.userId);
    if (outro) await removerUsuarioTeste(outro.userId);
  });

  it("versoesDoTurno em ordem crescente", async () => {
    const vs = await versoesDoTurno(u.cliente, turnoId);
    expect(vs.map((v) => v.numero)).toEqual([1, 2]);
    expect(typeof vs[0].emitido_em).toBe("string");
  });

  it("listarVersoes traz os dados da foto e o status do turno", async () => {
    const itens = await listarVersoes(u.cliente, { obraId });
    expect(itens).toHaveLength(2);
    for (const i of itens) {
      expect(i).toMatchObject({
        turnoId, obraId, obraNome: "Obra Leitura", data: "2026-11-05", periodo: "noturno",
        turnoStatus: "fechado", retroativa: false, percentual: 1,
      });
    }
    expect(itens.map((i) => i.numero).sort()).toEqual([1, 2]);
    expect(await listarVersoes(u.cliente, {})).toHaveLength(2);
  });

  it("obterVersao devolve a foto", async () => {
    const [v1] = await versoesDoTurno(u.cliente, turnoId);
    const v = await obterVersao(u.cliente, v1.id);
    expect(v).toMatchObject({ id: v1.id, turno_id: turnoId, obra_id: obraId, numero: 1, formato: 1 });
    expect(v!.dados).not.toBeNull();
  });

  it("outra empresa e ids inválidos não enxergam nada", async () => {
    const [v1] = await versoesDoTurno(u.cliente, turnoId);
    expect(await obterVersao(outro.cliente, v1.id)).toBeNull();
    expect(await listarVersoes(outro.cliente, { obraId })).toEqual([]);
    expect(await versoesDoTurno(outro.cliente, turnoId)).toEqual([]);
    expect(await obterVersao(u.cliente, "xyz")).toBeNull();
    expect(await obterVersao(u.cliente, crypto.randomUUID())).toBeNull();
    expect(await listarVersoes(u.cliente, { obraId: "xyz" })).toEqual([]);
    expect(await versoesDoTurno(u.cliente, "xyz")).toEqual([]);
  });
});
