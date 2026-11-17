import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adicionarAtividade } from "@/lib/db/atividades";
import { salvarEfetivo } from "@/lib/db/campo";
import { salvarExecucaoPlanejador } from "@/lib/db/execucao";
import { enviarFotoParadaCampo, enviarFotoParadaPlanejador, urlsFotos } from "@/lib/db/fotosParada";
import { ERRO_OCORRENCIA_INVALIDA } from "@/lib/db/mensagens";
import { criarObra } from "@/lib/db/obras";
import { criarOcorrenciaCampo, removerOcorrenciaCampo } from "@/lib/db/ocorrencias";
import { aplicarAcao, criarTurno, obterTurnoCompleto } from "@/lib/db/turnos";
import type { DadosOcorrencia } from "@/lib/db/validacao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarUsuarioTeste, ligado, removerUsuarioTeste, VAZIO, type UsuarioTeste } from "./ajuda";

const JPEG = new Uint8Array(Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
));
const form = (bytes: Uint8Array<ArrayBuffer>, type = "image/jpeg") => {
  const f = new FormData();
  f.set("foto", new File([bytes], "foto.jpg", { type }));
  return f;
};

describe.skipIf(!ligado)("foto da parada", () => {
  let u: UsuarioTeste;
  beforeAll(async () => {
    u = await criarUsuarioTeste();
  });
  afterAll(async () => {
    if (u) await removerUsuarioTeste(u.userId);
  });

  async function cenario() {
    const o = await criarObra(u.cliente, { nome: "Obra Foto" });
    if (!o.ok) throw new Error(o.erro);
    const t = await criarTurno(u.cliente, {
      obra_id: o.dados.id, data: "2026-11-16", periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00",
    });
    if (!t.ok) throw new Error(t.erro);
    const a = await adicionarAtividade(u.cliente, t.dados.id, { descricao: "Bomba", unidade: "un", qtd_planejada: 1 });
    if (!a.ok) throw new Error(a.erro);
    const resp = async (nome: string) =>
      (await u.cliente.from("responsaveis").insert({ obra_id: o.dados.id, nome }).select("id").single()).data!.id as string;
    const joao = await resp("João");
    const ana = await resp("Ana");
    const l = await aplicarAcao(u.cliente, t.dados.id, "liberar");
    if (!l.ok || !l.dados.token) throw new Error("liberar");
    const token = l.dados.token;
    const e = await salvarEfetivo(token, [{ funcao: "Mecânico", quantidade: 3 }], [], joao);
    if (!e.ok) throw new Error(e.erro);
    const d: DadosOcorrencia = {
      id: randomUUID(), tipo: "parado", funcao: "Mecânico", quantidade: 2, hora_inicio: "10:40", hora_fim: null,
      destino_responsavel_id: null, emprestimo_id: null, causa: "material", observacao: null, aguardando_responsavel_id: null,
    };
    const r = await criarOcorrenciaCampo(token, d, joao);
    if (!r.ok) throw new Error(r.erro);
    return { turnoId: t.dados.id, atividadeId: a.dados.id, token, joao, ana, paradaId: d.id };
  }
  const objetos = async (turnoId: string) => {
    const t = await obterTurnoCompleto(u.cliente, turnoId);
    const pasta = `${t!.obra.empresa_id}/${t!.obra_id}/${turnoId}`;
    const { data } = await criarClienteAdmin().storage.from("paradas").list(pasta);
    return (data ?? []).map((x) => x.name);
  };
  const caminho = async (turnoId: string, id: string) =>
    (await obterTurnoCompleto(u.cliente, turnoId))?.ocorrencias.find((o) => o.id === id)?.foto_path ?? null;

  it("envia, grava o caminho e gera URL assinada; remover a parada remove a foto", { timeout: 60_000 }, async () => {
    const c = await cenario();
    expect(await enviarFotoParadaCampo(c.token, c.paradaId, c.joao, form(JPEG))).toEqual({ ok: true, dados: undefined });
    const p = await caminho(c.turnoId, c.paradaId);
    expect(p).toMatch(new RegExp(`${c.turnoId}/${c.paradaId}\\.jpg$`));
    expect(await objetos(c.turnoId)).toEqual([`${c.paradaId}.jpg`]);
    const urls = await urlsFotos([p!]);
    expect(urls[p!]).toMatch(/^https?:\/\/.+token=/);
    expect((await removerOcorrenciaCampo(c.token, c.paradaId, c.joao)).ok).toBe(true);
    expect(await objetos(c.turnoId)).toEqual([]);
  });

  it("tipo errado e arquivo grande são recusados", { timeout: 60_000 }, async () => {
    const c = await cenario();
    expect(await enviarFotoParadaCampo(c.token, c.paradaId, c.joao, form(JPEG, "image/gif"))).toEqual({ ok: false, erro: "Envie uma foto" });
    const grande = new Uint8Array(2 * 1024 * 1024 + 10);
    expect(await enviarFotoParadaCampo(c.token, c.paradaId, c.joao, form(grande))).toEqual({ ok: false, erro: "Foto muito grande" });
    expect(await objetos(c.turnoId)).toEqual([]);
  });

  it("outra equipe não envia foto na parada", { timeout: 60_000 }, async () => {
    const c = await cenario();
    expect(await enviarFotoParadaCampo(c.token, c.paradaId, c.ana, form(JPEG))).toEqual({ ok: false, erro: ERRO_OCORRENCIA_INVALIDA });
  });

  it("planejador envia foto", { timeout: 60_000 }, async () => {
    const c = await cenario();
    expect((await enviarFotoParadaPlanejador(u.cliente, c.turnoId, c.paradaId, form(JPEG))).ok).toBe(true);
    expect(await caminho(c.turnoId, c.paradaId)).toBeTruthy();
  });

  it("turno fechado: recusado e nenhum arquivo fica no armazenamento", { timeout: 60_000 }, async () => {
    const c = await cenario();
    const e = await salvarExecucaoPlanejador(u.cliente, c.turnoId, c.atividadeId, { qtd_realizada: 1, causa: null, observacao: null }, VAZIO);
    if (!e.ok) throw new Error(e.erro);
    const f = await aplicarAcao(u.cliente, c.turnoId, "fechar");
    if (!f.ok) throw new Error(f.erro);
    expect((await enviarFotoParadaCampo(c.token, c.paradaId, c.joao, form(JPEG))).ok).toBe(false);
    expect((await enviarFotoParadaPlanejador(u.cliente, c.turnoId, c.paradaId, form(JPEG))).ok).toBe(false);
    expect(await objetos(c.turnoId)).toEqual([]);
  });
});
