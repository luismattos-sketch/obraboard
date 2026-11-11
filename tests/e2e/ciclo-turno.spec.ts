import { devices, expect, test } from "@playwright/test";
import { limparUsuario, prepararUsuario, type UsuarioE2E } from "./preparar";

test.skip(process.env.SUPABASE_TEST !== "1", "E2E usa o Supabase de desenvolvimento (SUPABASE_TEST=1)");

let usuario: UsuarioE2E | undefined;

test.afterAll(async () => {
  if (usuario) await limparUsuario(usuario.userId);
});

test("ciclo completo do turno: planejar, liberar, lançar no campo, fechar e baixar o RDO", async ({ page, browser }) => {
  usuario = await prepararUsuario();
  page.on("dialog", (d) => d.accept());

  // Login
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(usuario.email);
  await page.getByLabel("Senha").fill(usuario.senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/obras");

  // Obra
  await page.getByRole("main").getByRole("link", { name: "Nova obra" }).click();
  await page.getByLabel("Nome da obra").fill("Obra E2E");
  await page.getByRole("button", { name: "Criar obra" }).click();
  await expect(page.getByRole("heading", { name: "Obra E2E" })).toBeVisible();

  // Menu lateral: a obra nova aparece destacada; recolher é lembrado após recarregar (cookie)
  const menuObras = page.getByRole("navigation", { name: "Obras" });
  await expect(menuObras.getByRole("link", { name: "Obra E2E" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Recolher menu" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Expandir menu" })).toBeVisible();
  await page.getByRole("button", { name: "Expandir menu" }).click();
  await expect(menuObras.getByRole("link", { name: "Obra E2E" })).toBeVisible();

  // Turno
  await page.getByRole("link", { name: "Novo turno" }).click();
  const dataTurno = await page.getByLabel("Data").inputValue();
  expect(dataTurno).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await page.getByRole("button", { name: "Criar turno" }).click();
  await page.waitForURL(/\/turnos\/[0-9a-f-]{36}$/);
  const turnoUrl = page.url();

  // Atividades
  async function adicionar(descricao: string, qtd: string, unidade: string) {
    await page.getByLabel("Descrição").fill(descricao);
    await page.getByLabel("Quantidade").fill(qtd);
    await page.getByLabel("Unidade").fill(unidade);
    await page.getByRole("button", { name: "Adicionar atividade" }).click();
    await expect(page.getByText(descricao).first()).toBeVisible();
    await expect(page.getByLabel("Descrição")).toHaveValue("");
  }
  await adicionar("Concretagem laje", "10", "m³");
  await adicionar("Alvenaria", "20", "m²");

  // Liberar e capturar o link
  await page.getByRole("button", { name: "Liberar para campo" }).click();
  await expect(page.getByRole("button", { name: "Copiar link" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Enviar pelo WhatsApp" })).toBeVisible();
  const urlCampo = (await page.locator("p.break-all").textContent())?.trim();
  expect(urlCampo).toMatch(/\/t\/.+/);

  // Encarregado: contexto móvel, sem login
  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  try {
    const campo = await ctx.newPage();
    await campo.goto(urlCampo!);
    const salvo = (secao: string) =>
      expect(campo.locator(`section[aria-labelledby="${secao}"]`).getByText("Salvo ✓").first()).toBeVisible({ timeout: 15_000 });

    // Horário
    await campo.getByLabel("Início").fill("07:00");
    await campo.getByLabel("Fim").fill("16:00");
    await salvo("titulo-horario");

    // Atividades
    const cards = campo.locator("section[aria-labelledby='titulo-atividades'] > div");
    await cards.nth(0).getByRole("button", { name: "100%" }).click();
    await expect(cards.nth(0).getByText("Salvo ✓")).toBeVisible({ timeout: 15_000 });
    await cards.nth(1).getByLabel(/Executado/).fill("8");
    await cards.nth(1).getByLabel("Causa do não cumprimento").selectOption({ label: "Material" });
    await expect(cards.nth(1).getByText("Salvo ✓")).toBeVisible({ timeout: 15_000 });

    // Efetivo
    await campo.getByRole("button", { name: "+ Adicionar função" }).click();
    await campo.getByLabel("Função").fill("Pedreiro");
    await campo.getByLabel("Quantidade").fill("4");
    await salvo("titulo-efetivo");

    // Clima
    await campo.getByLabel("Manhã").selectOption({ label: "Bom" });
    await salvo("titulo-clima");

    // Enviar
    await campo.getByRole("button", { name: "Enviar turno" }).click();
    await expect(campo.getByText("Turno enviado ✓")).toBeVisible({ timeout: 15_000 });

    // Planejador vê o resumo
    await page.goto(turnoUrl);
    const resumo = page.locator("section[aria-labelledby='titulo-resumo']");
    await expect(resumo.getByText("50%")).toBeVisible();
    await expect(resumo.getByText("Homens-hora").locator("xpath=following-sibling::p[1]")).toHaveText("36");

    // Fechar
    await page.getByRole("button", { name: "Fechar turno" }).click();
    await page.getByRole("button", { name: "Confirmar fechamento" }).click();
    await expect(page.getByRole("button", { name: "Reabrir turno" })).toBeVisible();

    // RDO
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Baixar RDO (v1)" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(`RDO-obra-e2e-${dataTurno}-diurno-v1.pdf`);

    // Análise (PPC) da obra
    const obraUrl = turnoUrl.replace(/\/turnos\/[0-9a-f-]{36}$/, "");
    // next dev compila a rota no 1º acesso e recarrega a página aberta; pré-aquecer evita a corrida.
    await page.request.get(`${obraUrl}/analise`);
    await page.goto(obraUrl);
    await page.getByRole("link", { name: "Análise (PPC)" }).click();
    await page.waitForURL("**/analise");
    const indicadores = page.locator("section[aria-labelledby='titulo-indicadores']");
    await expect(indicadores.getByText("50%").first()).toBeVisible();
    await expect(indicadores.getByText("1 de 2 atividades")).toBeVisible();
    const causas = page.locator("section[aria-labelledby='titulo-causas']");
    await expect(causas.getByText("Material")).toBeVisible();
    await expect(causas.getByText("1 (100%)")).toBeVisible();
    await causas.getByText("Material").click();
    await expect(causas.getByText(/Alvenaria/)).toBeVisible();

    // Campo após o fechamento
    await campo.reload();
    await expect(campo.getByText("Turno fechado pelo planejador")).toBeVisible();

    // Histórico de RDO: v1 na lista da obra; reabrir → prévia + v1 oficial; fechar de novo → v2
    await page.request.get(`${obraUrl}/rdos`);
    await page.request.get("/rdos");
    await page.goto(obraUrl);
    await page.getByRole("main").getByRole("link", { name: "RDOs" }).click();
    await page.waitForURL("**/rdos");
    const lista = page.getByRole("main").getByRole("list");
    await expect(lista.getByText("v1", { exact: true })).toBeVisible();

    await page.goto(turnoUrl);
    await page.getByRole("button", { name: "Reabrir turno" }).click();
    await page.getByLabel("Motivo da reabertura").fill("Corrigir quantidade");
    await page.getByRole("button", { name: "Confirmar reabertura" }).click();
    await expect(page.getByRole("link", { name: "Baixar prévia (rascunho)" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Baixar v1 oficial" })).toBeVisible();
    await page.getByRole("button", { name: "Fechar turno" }).click();
    await page.getByRole("button", { name: "Confirmar fechamento" }).click();
    await expect(page.getByRole("link", { name: "Baixar RDO (v2)" })).toBeVisible();
    await expect(page.getByText("Versões anteriores:")).toBeVisible();

    // Linha do tempo do turno
    await page.getByText(/^Histórico \(\d+\)$/).click();
    await expect(page.getByText(/Enviado pelo campo · Encarregado \(link de campo\)/)).toBeVisible();
    await expect(page.getByRole("link", { name: "RDO v2" })).toBeVisible();
    await expect(page.getByText("Motivo: Corrigir quantidade")).toBeVisible();

    await page.goto(`${obraUrl}/rdos`);
    await expect(lista.getByText("v2", { exact: true })).toBeVisible();
    await page.getByText("Versões anteriores (1)").click();
    await expect(page.getByText(/v1 · emitida/)).toBeVisible();

    await page.goto("/rdos");
    await expect(lista.getByText("Obra E2E")).toBeVisible();
  } finally {
    await ctx.close();
  }
});
