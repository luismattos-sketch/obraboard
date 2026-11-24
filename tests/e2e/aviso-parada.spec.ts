import path from "node:path";
import { devices, expect, test } from "@playwright/test";
import { adicionarAtividade } from "@/lib/db/atividades";
import { salvarEfetivo } from "@/lib/db/campo";
import { criarObra, editarWhatsappObra } from "@/lib/db/obras";
import { gerarLinkQuadro } from "@/lib/db/quadro";
import { aplicarAcao, criarTurno, obterTurnoCompleto } from "@/lib/db/turnos";
import { criarUsuarioTeste, removerUsuarioTeste, type UsuarioTeste } from "../integracao/ajuda";

test.skip(process.env.SUPABASE_TEST !== "1", "E2E usa o Supabase de desenvolvimento (SUPABASE_TEST=1)");

let u: UsuarioTeste | undefined;
test.afterAll(async () => {
  if (u) await removerUsuarioTeste(u.userId);
});

const hojeSP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
function exigir<T>(r: { ok: true; dados: T } | { ok: false; erro: string }): T {
  if (!r.ok) throw new Error(r.erro);
  return r.dados;
}

test("João avisa parada pelo link → quadro e turno mostram → encerra → RDO; Ana termina a parte dela", async ({ browser, request }) => {
  test.setTimeout(480_000);
  u = await criarUsuarioTeste();
  const obra = exigir(await criarObra(u.cliente, { nome: "Obra Parada E2E" }));
  exigir(await editarWhatsappObra(u.cliente, obra.id, "(11) 98888-7777"));
  const responsavel = async (nome: string) => {
    const { data, error } = await u!.cliente.from("responsaveis").insert({ obra_id: obra.id, nome }).select("id").single();
    if (error || !data) throw new Error(error?.message);
    return data.id as string;
  };
  const joao = await responsavel("João");
  const carlos = await responsavel("Carlos");
  const ana = await responsavel("Ana");
  const turno = exigir(await criarTurno(u.cliente, {
    obra_id: obra.id, data: hojeSP(), periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00",
  }));
  for (const [descricao, resp] of [["Bomba B-301", joao], ["Cabos VTI-02", carlos], ["Caldeiraria", ana]] as const) {
    const a = exigir(await adicionarAtividade(u.cliente, turno.id, { descricao, unidade: "un", qtd_planejada: 1 }));
    await u.cliente.from("atividades").update({ responsavel_id: resp }).eq("id", a.id);
  }
  const { token } = exigir(await aplicarAcao(u.cliente, turno.id, "liberar")) as { token: string };
  exigir(await salvarEfetivo(token, [{ funcao: "Mecânico", quantidade: 3 }], [], joao));
  exigir(await salvarEfetivo(token, [{ funcao: "Caldeireiro", quantidade: 4 }], [], ana));
  const { codigo } = exigir(await gerarLinkQuadro(u.cliente, obra.id));

  // next dev compila cada rota no 1º acesso: aquece antes de usar.
  await Promise.all([request.get("/login"), request.get(`/q/${codigo}?visao=checkout`)]);
  // Planejador abre o turno antes: next dev recarrega as páginas abertas ao compilar uma rota nova.
  const pl = await browser.newPage();
  await pl.goto("/login");
  await pl.getByLabel("E-mail").fill(u.email);
  await pl.getByLabel("Senha").fill(u.senha);
  await pl.getByRole("button", { name: "Entrar" }).click();
  await pl.waitForURL("**/obras");
  await pl.goto(`/obras/${obra.id}/turnos/${turno.id}`);

  // João pelo link de campo, no celular.
  const urlJoao = `/t/${token}?r=${joao}`;
  await request.get(urlJoao);
  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  const cel = await ctx.newPage();
  await cel.goto(urlJoao);
  await expect(cel.getByText("Lançando como")).toBeVisible();
  await cel.getByRole("button", { name: "⚠ Avisar parada" }).click();
  await cel.getByLabel("Quantos parados").fill("2");
  await cel.getByLabel("Por quê?").selectOption("atividade_predecessora");
  await cel.getByLabel("Qual equipe vocês aguardam").selectOption({ label: "Carlos" });
  await cel.getByLabel("Desde").fill("10:40");
  await cel.getByLabel("Observação (opcional)").fill("rolamento 6312");
  await cel.getByLabel("📷 Foto (opcional)").setInputFiles(path.join(process.cwd(), "public", "frentia-logo.png"));
  await cel.getByRole("button", { name: "Registrar parada" }).click();

  const parada = cel.getByRole("status").filter({ hasText: "parados desde 10:40" });
  await expect(parada).toContainText("2 Mecânicos parados desde 10:40 · Aguardando outra equipe (Carlos)");
  await expect(parada.getByRole("button", { name: "Voltamos a trabalhar" })).toBeVisible();
  const whats = parada.getByRole("link", { name: "Avisar no WhatsApp" });
  await expect(whats).toHaveAttribute("href", /^https:\/\/wa\.me\/5511988887777\?text=.*Parada/);
  await expect(parada.getByRole("img", { name: "Foto da parada" })).toBeVisible({ timeout: 30_000 });

  // TV (quadro público): faixa vermelha com a parada.
  const tv = await browser.newPage();
  await request.get(`/q/${codigo}?visao=checkout`);
  await tv.goto(`/q/${codigo}?visao=checkout`);
  await expect(tv.getByRole("alert", { name: "Paradas em aberto" })).toContainText("João · 2 Mecânico parados desde 10:40");

  // Planejador: faixa no topo do turno.
  await pl.reload();
  await expect(pl.getByRole("region", { name: "Paradas do turno" })).toContainText("João · Mecânico: 2 parados desde 10:40 · Aguardando outra equipe (Carlos) — rolamento 6312");

  // João encerra a parada.
  await parada.getByRole("button", { name: "Voltamos a trabalhar" }).click();
  await cel.getByLabel("Voltaram às").fill("13:15");
  await cel.getByRole("button", { name: "Confirmar" }).click();
  await expect(cel.getByText("✅ 2 Mecânicos voltaram às 13:15")).toBeVisible();
  await expect(cel.getByText("2 parados 10:40–13:15 · Aguardando outra equipe (Carlos)")).toBeVisible({ timeout: 30_000 });

  // Ana termina a parte dela.
  await cel.goto(`/t/${token}?r=${ana}`);
  // Caldeiraria não concluída: o Terminei cobra a causa antes.
  await cel.getByRole("button", { name: "✓ Terminei minha parte" }).click();
  await expect(cel.getByText("Antes de terminar, informe a causa em:")).toBeVisible();
  await cel.getByLabel("Causa do não cumprimento").selectOption({ label: "Falta material" });
  await expect(cel.locator("section[aria-labelledby='titulo-atividades'] > div").nth(0).getByText("Salvo ✓")).toBeVisible({ timeout: 15_000 });
  await cel.getByRole("button", { name: "✓ Terminei minha parte" }).click();
  await expect(cel.getByText(/Você avisou que terminou às \d\d:\d\d/)).toBeVisible();
  await expect(cel.getByText("salvando…")).toHaveCount(0);
  await ctx.close();

  await tv.reload();
  await expect(tv.getByText(/✓ terminou \d\d:\d\d/)).toBeVisible();
  await expect(tv.getByRole("alert", { name: "Paradas em aberto" })).toHaveCount(0);
  await tv.close();
  await pl.close();

  // RDO: a parada encerrada com a equipe aguardada e a foto guardada.
  const t = await obterTurnoCompleto(u.cliente, turno.id);
  const p = t!.ocorrencias.find((o) => o.tipo === "parado")!;
  expect(p).toMatchObject({ hora_fim: "13:15:00", aguardando_responsavel_id: carlos, observacao: "rolamento 6312" });
  expect(p.foto_path).toBeTruthy();
  expect(t!.terminados?.map((x) => x.responsavel_id)).toEqual([ana]);
});
