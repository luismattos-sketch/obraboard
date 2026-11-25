import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adicionarAtividade } from "@/lib/db/atividades";
import { criarObra } from "@/lib/db/obras";
import { aderenciaDaObra, criarTurno } from "@/lib/db/turnos";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, type UsuarioTeste } from "./ajuda";

describe.skipIf(!ligado)("aderência da obra", () => {
  let u: UsuarioTeste;
  beforeAll(async () => { u = await criarUsuarioTeste(); });
  afterAll(async () => { if (u) await removerUsuarioTeste(u.userId); });

  it("só turnos fechados da obra, sem extra", async () => {
    const o = await criarObra(u.cliente, { nome: "Obra Aderência" });
    if (!o.ok) throw new Error(o.erro);
    const admin = criarClienteAdmin();
    for (const [data, fechar] of [["2026-11-10", true], ["2026-11-11", false]] as const) {
      const t = await criarTurno(u.cliente, { obra_id: o.dados.id, data, periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "16:00" });
      if (!t.ok) throw new Error(t.erro);
      for (const d of ["A", "B"]) {
        const a = await adicionarAtividade(u.cliente, t.dados.id, { descricao: d, unidade: "un", qtd_planejada: 2 });
        if (!a.ok) throw new Error(a.erro);
      }
      const ok = (r: { error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); };
      ok(await admin.from("atividades").update({ qtd_realizada: 2 }).eq("turno_id", t.dados.id).eq("descricao", "A"));
      ok(await admin.from("atividades").update({ causa: "material" }).eq("turno_id", t.dados.id).eq("descricao", "B"));
      ok(await admin.from("atividades").insert({ turno_id: t.dados.id, ordem: 9, descricao: "X", unidade: "un", qtd_planejada: 1, qtd_realizada: 1, tipo: "extra" }));
      if (fechar) ok(await admin.from("turnos").update({ status: "fechado" }).eq("id", t.dados.id));
    }
    expect(await aderenciaDaObra(u.cliente, o.dados.id)).toEqual({ concluidas: 1, total: 2, ppc: 0.5 });
  }, 60_000);
});
