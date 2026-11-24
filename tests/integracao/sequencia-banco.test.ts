import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { salvarExecucaoPlanejador } from "@/lib/db/execucao";
import { criarObra } from "@/lib/db/obras";
import { criarRascunho, obterDadosSemana, programarSemana, salvarAtividadeProgramada } from "@/lib/db/programacao";
import { criarResponsavel } from "@/lib/db/responsaveis";
import { criarTurno } from "@/lib/db/turnos";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, VAZIO, type UsuarioTeste } from "./ajuda";

// Item 19: andaime 12 m seg diurno (Luis) → 12 m seg noturno (Alberto), semana de 09/11/2026.
describe.skipIf(!ligado)("atividades em sequência", () => {
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
    const obra = exigir(await criarObra(u.cliente, { nome: "Obra Sequência" }));
    const luis = exigir(await criarResponsavel(u.cliente, obra.id, { nome: "Luis" })).id;
    const alberto = exigir(await criarResponsavel(u.cliente, obra.id, { nome: "Alberto" })).id;
    const semana = exigir(await criarRascunho(u.cliente, obra.id, "2026-11-09"));
    const base = { descricao: "Montagem de Andaime", unidade: "m", meta: 12, dias: [0 as const], equipe: [{ funcao: "Montador", quantidade: 2 }] };
    const dia = exigir(await salvarAtividadeProgramada(u.cliente, semana.id, { ...base, periodo: "diurno", responsavel_id: luis })).id;
    const noite = exigir(
      await salvarAtividadeProgramada(u.cliente, semana.id, { ...base, periodo: "noturno", responsavel_id: alberto, continua_de: dia }),
    ).id;
    return { obraId: obra.id, semana, dia, noite };
  }

  const turno = (obraId: string, periodo: "diurno" | "noturno") =>
    criarTurno(u.cliente, { obra_id: obraId, data: "2026-11-09", periodo, hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00" });

  async function atividadeDo(turnoId: string) {
    const { data, error } = await u.cliente.from("atividades").select("id, qtd_planejada, meta_origem").eq("turno_id", turnoId).single();
    if (error) throw new Error(error.message);
    return { ...data, qtd_planejada: Number(data.qtd_planejada) };
  }

  it("grava o vínculo e recusa vínculo com outra semana", { timeout: 60_000 }, async () => {
    const { obraId, semana, dia, noite } = await cenario();
    const dados = await obterDadosSemana(u.cliente, semana);
    expect(dados.atividades.find((a) => a.id === noite)?.continua_de).toBe(dia);
    const outra = exigir(await criarRascunho(u.cliente, obraId, "2026-11-16"));
    const r = await salvarAtividadeProgramada(u.cliente, outra.id, {
      descricao: "X", unidade: "m", meta: 1, dias: [0], periodo: "diurno", equipe: [], continua_de: dia,
    });
    expect(r).toMatchObject({ ok: false, erro: "Só dá para continuar uma atividade da mesma semana." });
  });

  it("faltou 4 m no dia: a noite já trazida passa a 16 m e mostra a origem", { timeout: 60_000 }, async () => {
    const { obraId, semana } = await cenario();
    exigir(await programarSemana(u.cliente, semana.id));
    const td = exigir(await turno(obraId, "diurno"));
    const tn = exigir(await turno(obraId, "noturno"));
    expect(await atividadeDo(tn.id)).toMatchObject({ qtd_planejada: 12, meta_origem: null });

    const ad = await atividadeDo(td.id);
    exigir(await salvarExecucaoPlanejador(u.cliente, td.id, ad.id, { qtd_realizada: 8, causa: null, observacao: null }, VAZIO));
    expect(await atividadeDo(tn.id)).toMatchObject({ qtd_planejada: 16, meta_origem: "inclui 4 m do turno do dia (Luis)" });
  });
});
