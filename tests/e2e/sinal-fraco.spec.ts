import { devices, expect, test, type Page } from "@playwright/test";
import { adicionarAtividade } from "@/lib/db/atividades";
import { criarObra } from "@/lib/db/obras";
import { aplicarAcao, criarTurno } from "@/lib/db/turnos";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarUsuarioTeste, removerUsuarioTeste, type UsuarioTeste } from "../integracao/ajuda";

test.skip(process.env.SUPABASE_TEST !== "1", "E2E usa o Supabase de desenvolvimento (SUPABASE_TEST=1)");

let u: UsuarioTeste | undefined;
test.afterAll(async () => {
  if (u) await removerUsuarioTeste(u.userId);
});

const exigir = <T,>(r: { ok: true; dados: T } | { ok: false; erro: string }): T => {
  if (!r.ok) throw new Error(r.erro);
  return r.dados;
};

/** "Rede que finge": o celular acha que tem sinal, mas toda gravação cai. */
const fingir = (p: Page) => p.route("**/*", (r) => (r.request().method() === "POST" ? r.abort("connectionreset") : r.continue()));

test("sinal fraco: nunca desiste, avisa, não mostra verde antes de salvar e pergunta ao sair", async ({ browser }) => {
  test.setTimeout(180_000);
  u = await criarUsuarioTeste();
  const obra = exigir(await criarObra(u.cliente, { nome: "Obra Sinal Fraco" }));
  const t = exigir(await criarTurno(u.cliente, {
    obra_id: obra.id, data: "2027-02-01", periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "16:00",
  }));
  const a0 = exigir(await adicionarAtividade(u.cliente, t.id, { descricao: "Cabos", unidade: "m", qtd_planejada: 10 }));
  exigir(await adicionarAtividade(u.cliente, t.id, { descricao: "Megger", unidade: "m", qtd_planejada: 10 }));
  const { token } = exigir(await aplicarAcao(u.cliente, t.id, "liberar"));
  const qtdNoBanco = async () =>
    Number((await criarClienteAdmin().from("atividades").select("qtd_realizada").eq("id", a0.id).single()).data!.qtd_realizada);

  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  const campo = await ctx.newPage();
  await campo.request.get(`/t/${token}`);
  await campo.goto(`/t/${token}`);
  const cards = campo.locator("section[aria-labelledby='titulo-atividades'] > div");
  const c0 = cards.nth(0);
  const c1 = cards.nth(1);
  const topo = campo.getByText(/lançamentos? não salvos?\./);

  // 1. Rede boa: salva e o aviso do topo nunca aparece
  await c0.getByLabel(/Total feito hoje/).fill("2");
  await expect(c0.getByText("Salvo ✓")).toBeVisible({ timeout: 15_000 });
  await expect(topo).toHaveCount(0);

  // 2. Nova edição: o "Salvo ✓" antigo some na hora
  await c0.getByLabel(/Total feito hoje/).fill("3");
  await expect(c0.getByText("Salvo ✓")).toHaveCount(0, { timeout: 300 });
  await expect(c0.getByText("Salvando…")).toBeVisible();
  await expect(c0.getByText("Salvo ✓")).toBeVisible({ timeout: 15_000 });

  // 3. Rede que finge: dois blocos falham
  await fingir(campo);
  await c0.getByLabel(/Total feito hoje/).fill("5");
  await c1.getByLabel(/Total feito hoje/).fill("4");
  await expect(c0.getByText("Não salvo — sem sinal. Tentando de novo…")).toBeVisible({ timeout: 15_000 });
  await expect(c1.getByText("Não salvo — sem sinal. Tentando de novo…")).toBeVisible({ timeout: 15_000 });
  await expect(campo.getByText("⚠ 2 lançamentos não salvos. Não feche nem atualize esta tela.")).toBeVisible();
  await expect(campo.getByRole("button", { name: "Salvando…" })).toBeDisabled();
  await expect(c0.locator("[data-tom]")).toHaveAttribute("data-tom", "neutro");

  // 4. Muda durante a falha e espera mais que o antigo "desistir" (~26 s)
  await c0.getByLabel(/Total feito hoje/).fill("7");
  await campo.waitForTimeout(40_000);
  await expect(c0.getByText("Não salvo — sem sinal. Tentando de novo…")).toBeVisible();
  await expect(campo.getByText(/Recarregue a página/)).toHaveCount(0);

  // 5. Erro de negócio não conta como "não salvo"
  await c1.getByLabel(/Total feito hoje/).fill("abc");
  await expect(c1.getByText("Digite um número válido").first()).toBeVisible({ timeout: 15_000 });
  await expect(campo.getByText("⚠ 1 lançamento não salvo. Não feche nem atualize esta tela.")).toBeVisible({ timeout: 15_000 });

  // 6. Rede volta; "Tentar de novo" do topo salva o último valor
  await campo.unroute("**/*");
  await campo.getByRole("alert").filter({ hasText: "lançamento não salvo" }).getByRole("button", { name: "Tentar de novo" }).click();
  await expect(c0.getByText("Salvo ✓")).toBeVisible({ timeout: 15_000 });
  expect(await qtdNoBanco()).toBe(7);
  await expect(topo).toHaveCount(0);
  await c1.getByLabel(/Total feito hoje/).fill("4");
  await expect(c1.getByText("Salvo ✓")).toBeVisible({ timeout: 15_000 });

  // 7. Sem rede de verdade: volta sozinho quando a conexão volta
  await ctx.setOffline(true);
  await c0.getByLabel(/Total feito hoje/).fill("8");
  await expect(c0.getByText("Não salvo — sem sinal. Tentando de novo…")).toBeVisible({ timeout: 15_000 });
  await ctx.setOffline(false);
  await expect(c0.getByText("Salvo ✓")).toBeVisible({ timeout: 15_000 });
  expect(await qtdNoBanco()).toBe(8);

  // 7b. Resposta perdida: o 6 chega ao banco mas a tela não fica sabendo; a próxima edição não é "conflito"
  await campo.route("**/*", async (r) => {
    if (r.request().method() !== "POST") return r.continue();
    await r.fetch();
    await r.abort("connectionreset");
  });
  await c0.getByLabel(/Total feito hoje/).fill("6");
  await expect(c0.getByText("Não salvo — sem sinal. Tentando de novo…")).toBeVisible({ timeout: 15_000 });
  await expect.poll(qtdNoBanco, { timeout: 15_000 }).toBe(6);
  await campo.unroute("**/*");
  await c0.getByLabel(/Total feito hoje/).fill("5");
  await expect(c0.getByText("Salvo ✓")).toBeVisible({ timeout: 15_000 });
  await expect(c0.getByText(/Mudou em outra tela/)).toHaveCount(0);
  expect(await qtdNoBanco()).toBe(5);
  // efetivo: mesma situação
  await campo.route("**/*", async (r) => {
    if (r.request().method() !== "POST") return r.continue();
    await r.fetch();
    await r.abort("connectionreset");
  });
  const efetivo = campo.locator("section[aria-labelledby='titulo-efetivo']");
  await efetivo.getByRole("button", { name: "+ Adicionar função" }).click();
  await efetivo.getByLabel("Função").selectOption({ index: 1 });
  await efetivo.getByLabel("Quantidade").fill("3");
  await expect(efetivo.getByText("Não salvo — sem sinal. Tentando de novo…")).toBeVisible({ timeout: 15_000 });
  await campo.unroute("**/*");
  await efetivo.getByLabel("Quantidade").fill("4");
  await expect(efetivo.getByText("Salvo ✓")).toBeVisible({ timeout: 15_000 });
  await expect(efetivo.getByText(/mudou em outra tela/)).toHaveCount(0);

  // 8. Sair com pendência: o navegador pergunta
  await fingir(campo);
  await c0.getByLabel(/Total feito hoje/).fill("9");
  await expect(c0.getByText("Não salvo — sem sinal. Tentando de novo…")).toBeVisible({ timeout: 15_000 });
  const dialogo = campo.waitForEvent("dialog");
  await campo.close({ runBeforeUnload: true });
  const d = await dialogo;
  expect(d.type()).toBe("beforeunload");
  await d.dismiss();
  await ctx.close();
});
