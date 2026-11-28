import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apagarItemManual, importarCronograma, listarItensCronograma, salvarItemManual } from "@/lib/db/cronograma";
import { criarObra } from "@/lib/db/obras";
import { apagarRestricao, listarRestricoesDaObra, marcarRemovida, salvarRestricao } from "@/lib/db/restricoes";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

const exigir = <T,>(r: { ok: true; dados: T } | { ok: false; erro: string }): T => {
  if (!r.ok) throw new Error(r.erro);
  return r.dados;
};
const dados = { tipo: "liberacao_area", descricao: "PT da área 2", responsavel: "Marcos (cliente)", prazo: "2026-12-01" };

describe.skipIf(!ligado)("restrições do lookahead (5.2)", () => {
  let a: UsuarioTeste;
  let b: UsuarioTeste;
  beforeAll(async () => {
    a = await criarUsuarioTeste();
    b = await criarUsuarioTeste();
  });
  afterAll(async () => {
    if (a) await removerUsuarioTeste(a.userId);
    if (b) await removerUsuarioTeste(b.userId);
  });

  it("cria, edita, remove, reabre, apaga e protege por empresa", { timeout: 120_000 }, async () => {
    const obra = exigir(await criarObra(a.cliente, { nome: "Obra Restrições" }));
    const item = exigir(await salvarItemManual(a.cliente, obra.id, { descricao: "Montar", inicio: "2026-12-01", fim: "2026-12-02", local: null, unidade: null, quantidade: null }));
    const r = exigir(await salvarRestricao(a.cliente, item.id, dados));
    exigir(await salvarRestricao(a.cliente, item.id, { ...dados, descricao: "PT da área 2 e 3" }, r.id));
    exigir(await marcarRemovida(a.cliente, r.id, true));
    let mapa = await listarRestricoesDaObra(a.cliente, obra.id);
    expect(mapa.get(item.id)?.[0]).toMatchObject({ descricao: "PT da área 2 e 3", responsavel: "Marcos (cliente)" });
    expect(mapa.get(item.id)?.[0].removida_em).not.toBeNull();
    exigir(await marcarRemovida(a.cliente, r.id, false));
    mapa = await listarRestricoesDaObra(a.cliente, obra.id);
    expect(mapa.get(item.id)?.[0].removida_em).toBeNull();

    expect((await salvarRestricao(b.cliente, item.id, dados)).ok).toBe(false);
    expect((await listarRestricoesDaObra(b.cliente, obra.id)).size).toBe(0);

    exigir(await apagarRestricao(a.cliente, r.id));
    expect((await listarRestricoesDaObra(a.cliente, obra.id)).size).toBe(0);
  });

  it("item que sai do cronograma mantém; item manual apagado leva as restrições", { timeout: 120_000 }, async () => {
    const obra = exigir(await criarObra(a.cliente, { nome: "Obra Restrições 2" }));
    const mapa = { codigo: 0, descricao: 1, inicio: 2, fim: 3 };
    const lido = (codigo: string) => ({ codigo, descricao: `Item ${codigo}`, inicio: "2026-12-01", fim: "2026-12-05", local: null, unidade: null, quantidade: null });
    exigir(await importarCronograma(a.cliente, obra.id, "v1.csv", mapa, [lido("A"), lido("B")]));
    const itA = (await listarItensCronograma(a.cliente, obra.id)).find((i) => i.codigo === "A")!;
    exigir(await salvarRestricao(a.cliente, itA.id, dados));
    exigir(await importarCronograma(a.cliente, obra.id, "v2.csv", mapa, [lido("B")]));
    expect((await listarRestricoesDaObra(a.cliente, obra.id)).get(itA.id)).toHaveLength(1);

    const m = exigir(await salvarItemManual(a.cliente, obra.id, { descricao: "Andaime", inicio: "2026-12-01", fim: "2026-12-01", local: null, unidade: null, quantidade: null }));
    exigir(await salvarRestricao(a.cliente, m.id, dados));
    exigir(await apagarItemManual(a.cliente, m.id));
    expect((await listarRestricoesDaObra(a.cliente, obra.id)).has(m.id)).toBe(false);
  });
});
