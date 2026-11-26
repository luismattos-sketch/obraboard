import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adicionarAtividade, definirResponsavel } from "@/lib/db/atividades";
import { criarObra } from "@/lib/db/obras";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { entradaDoTurno, gerarLinkQuadro, linkQuadro, obraPorCodigo, turnosDaObra } from "@/lib/db/quadro";
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

  it("entrada, turnos e sem foto do check-in ao liberar", { timeout: 60_000 }, async () => {
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

    // O quadro é único (sem foto oficial): liberar o turno não grava mais em checkin_fotos.
    exigir(await aplicarAcao(u.cliente, t.id, "liberar"));
    const { data: fotos, error } = await criarClienteAdmin().from("checkin_fotos").select("turno_id").eq("turno_id", t.id);
    expect(error).toBeNull();
    expect(fotos).toEqual([]);
    expect(await entradaDoTurno(u.cliente, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("link do quadro: gerar, resolver e trocar", { timeout: 60_000 }, async () => {
    const obra = exigir(await criarObra(u.cliente, { nome: "Obra Quadro Link" }));
    expect(await linkQuadro(u.cliente, obra.id)).toEqual({ existe: false, codigo: null });
    const { codigo } = exigir(await gerarLinkQuadro(u.cliente, obra.id));
    expect(await linkQuadro(u.cliente, obra.id)).toEqual({ existe: true, codigo });
    expect(await obraPorCodigo(codigo)).toEqual({ id: obra.id });

    const { codigo: novo } = exigir(await gerarLinkQuadro(u.cliente, obra.id));
    expect(await obraPorCodigo(codigo)).toBeNull();
    expect(await obraPorCodigo(novo)).toEqual({ id: obra.id });
    expect(await linkQuadro(u.cliente, obra.id)).toEqual({ existe: true, codigo: novo });
    expect(await obraPorCodigo("curto")).toBeNull();
  });
});
