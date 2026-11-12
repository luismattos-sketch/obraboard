import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adicionarAtividade, definirResponsavel } from "@/lib/db/atividades";
import { criarObra } from "@/lib/db/obras";
import { entradaDoTurno, fotoCheckin, gerarLinkQuadro, obraPorCodigo, temLinkQuadro, turnosDaObra } from "@/lib/db/quadro";
import { criarResponsavel } from "@/lib/db/responsaveis";
import { aplicarAcao, criarTurno } from "@/lib/db/turnos";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

describe.skipIf(!ligado)("quadro (leitura e link)", () => {
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

  it("entrada, turnos e foto do check-in", { timeout: 60_000 }, async () => {
    const obra = exigir(await criarObra(u.cliente, { nome: "Obra Quadro Leitura" }));
    const ana = exigir(await criarResponsavel(u.cliente, obra.id, { nome: "Ana" }));
    const t = exigir(await criarTurno(u.cliente, {
      obra_id: obra.id, data: "2026-11-10", periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "16:00",
    }));
    const at = exigir(await adicionarAtividade(u.cliente, t.id, { descricao: "Forma", unidade: "m²", qtd_planejada: 10 }));
    exigir(await definirResponsavel(u.cliente, at.id, ana.id));

    const e = (await entradaDoTurno(u.cliente, t.id))!;
    expect(e.obra.nome).toBe("Obra Quadro Leitura");
    expect(e.responsaveis).toEqual([{ id: ana.id, nome: "Ana", ativo: true }]);
    expect(e.atividades[0]).toMatchObject({ descricao: "Forma", qtd_planejada: 10, programada: false, responsavel_id: ana.id });
    expect(await turnosDaObra(u.cliente, obra.id)).toEqual([{ id: t.id, data: "2026-11-10", periodo: "diurno", status: "planejado" }]);
    expect(await fotoCheckin(u.cliente, t.id)).toBeNull();

    exigir(await aplicarAcao(u.cliente, t.id, "liberar"));
    const f = (await fotoCheckin(u.cliente, t.id))!;
    expect(f.dados.atividades[0].responsavel_id).toBe(ana.id);
    expect(typeof f.emitido_em).toBe("string");
    expect(await entradaDoTurno(u.cliente, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("link do quadro: gerar, resolver e trocar", { timeout: 60_000 }, async () => {
    const obra = exigir(await criarObra(u.cliente, { nome: "Obra Quadro Link" }));
    expect(await temLinkQuadro(u.cliente, obra.id)).toBe(false);
    const { codigo } = exigir(await gerarLinkQuadro(u.cliente, obra.id));
    expect(await temLinkQuadro(u.cliente, obra.id)).toBe(true);
    expect(await obraPorCodigo(codigo)).toEqual({ id: obra.id });

    const { codigo: novo } = exigir(await gerarLinkQuadro(u.cliente, obra.id));
    expect(await obraPorCodigo(codigo)).toBeNull();
    expect(await obraPorCodigo(novo)).toEqual({ id: obra.id });
    expect(await obraPorCodigo("curto")).toBeNull();
  });
});
