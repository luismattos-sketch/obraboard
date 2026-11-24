import { devices, expect, test } from "@playwright/test";
import { limparUsuario, prepararUsuario, type UsuarioE2E } from "./preparar";

test.skip(process.env.SUPABASE_TEST !== "1", "E2E usa o Supabase de desenvolvimento (SUPABASE_TEST=1)");

let usuario: UsuarioE2E | undefined;

test.afterAll(async () => {
  if (usuario) await limparUsuario(usuario.userId);
});

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** Hoje (YYYY-MM-DD) e o dia da semana (0 = segunda) no fuso de São Paulo. */
function hojeSP() {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const dia = (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
  return { iso, dia };
}

test("programação semanal: programar, executar no turno, encerrar e ver o PPC", async ({ page, browser }) => {
  usuario = await prepararUsuario();
  page.on("dialog", (d) => d.accept());
  const hoje = hojeSP();

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(usuario.email);
  await page.getByLabel("Senha").fill(usuario.senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/obras");

  await page.getByRole("main").getByRole("link", { name: "Nova obra" }).click();
  await page.getByLabel("Nome da obra").fill("Obra Programação E2E");
  await page.getByRole("button", { name: "Criar obra" }).click();
  await expect(page.getByRole("heading", { name: "Obra Programação E2E" })).toBeVisible();
  const obraUrl = page.url();

  // Programação da semana atual
  await page.request.get(`${obraUrl}/programacao`);
  await page.getByRole("complementary", { name: "Menu" }).getByRole("link", { name: "Programação", exact: true }).click();
  await page.waitForURL("**/programacao");
  await page.request.get(`${obraUrl}/programacao/${hoje.iso}`);
  await page.getByLabel("Data da semana").fill(hoje.iso);
  await page.getByRole("button", { name: "Abrir semana" }).click();
  await page.waitForURL(/\/programacao\/\d{4}-\d{2}-\d{2}$/);
  const semanaUrl = page.url();
  await expect(page.getByText("Rascunho")).toBeVisible();

  await page.getByLabel("Descrição").fill("Montar tubulação linha 3");
  await page.getByLabel("Meta da semana").fill("10");
  await page.getByLabel("Unidade").fill("m");
  await page.locator("label", { hasText: new RegExp(`^${DIAS[hoje.dia]}$`) }).click();
  await page.getByLabel("Função", { exact: true }).fill("Caldeireiro");
  await page.getByLabel("Qtd").fill("2");
  await page.getByRole("button", { name: "Adicionar atividade" }).click();
  await expect(page.getByText("2 Caldeireiro")).toBeVisible();

  await page.getByRole("button", { name: "Programar semana" }).click();
  await expect(page.getByText("PPC da semana (provisório)")).toBeVisible();
  await expect(page.getByText("0% — 0 de 1")).toBeVisible();

  // Turno de hoje já nasce com a atividade programada (último dia = saldo inteiro)
  await page.goto(obraUrl);
  await page.getByRole("link", { name: "Novo turno" }).click();
  await expect(page.getByLabel("Data")).toHaveValue(hoje.iso);
  await page.getByRole("button", { name: "Criar turno" }).click();
  await page.waitForURL(/\/turnos\/[0-9a-f-]{36}$/);
  const turnoUrl = page.url();
  await expect(page.getByText("Montar tubulação linha 3")).toBeVisible();
  await expect(page.getByText("Programada", { exact: true })).toBeVisible();
  await expect(page.getByText(/10 m$/)).toBeVisible();

  await page.getByRole("button", { name: "Liberar para campo" }).click();
  await expect(page.getByRole("button", { name: "Copiar link" })).toBeVisible();
  const urlCampo = (await page.locator("p.break-all").textContent())?.trim();

  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  try {
    const campo = await ctx.newPage();
    await campo.goto(urlCampo!);
    const salvo = (secao: string) =>
      expect(campo.locator(`section[aria-labelledby="${secao}"]`).getByText("Salvo ✓").first()).toBeVisible({ timeout: 15_000 });
    const card = campo.locator("section[aria-labelledby='titulo-atividades'] > div").nth(0);
    await card.getByLabel(/Total feito hoje/).fill("3");
    await card.getByRole("button", { name: "Não vai dar para concluir? Informar causa" }).click();
    await card.getByLabel("Causa do não cumprimento").selectOption({ label: "Falta material" });
    await expect(card.getByText("Salvo ✓")).toBeVisible({ timeout: 15_000 });
    // Efetivo já vem com a equipe programada (2 Caldeireiro): confirmar grava.
    await expect(campo.getByText("Previsto pela programação — confirme ou ajuste")).toBeVisible();
    await expect(campo.getByLabel("Função")).toHaveValue("Caldeireiro");
    await campo.getByRole("button", { name: "Confirmar equipe" }).click();
    await salvo("titulo-efetivo");
    await campo.getByRole("button", { name: "Enviar turno" }).click();
    await expect(campo.getByText("Turno enviado ✓")).toBeVisible({ timeout: 15_000 });
  } finally {
    await ctx.close();
  }

  await page.goto(turnoUrl);

  // Horário: quem preenche é o planejador
  const salvoP = (secao: string) =>
    expect(page.locator(`section[aria-labelledby="${secao}"]`).getByText("Salvo ✓").first()).toBeVisible({ timeout: 15_000 });
  await page.locator("section[aria-labelledby='titulo-horario']").getByLabel("Início").fill("07:00");
  await page.locator("section[aria-labelledby='titulo-horario']").getByLabel("Fim").fill("17:00");
  await salvoP("titulo-horario");
  await page.reload();
  await page.getByRole("button", { name: "Fechar turno" }).click();
  await page.getByRole("button", { name: "Confirmar fechamento" }).click();
  await expect(page.getByRole("button", { name: "Reabrir turno" })).toBeVisible();

  // Encerrar a semana com a causa pré-selecionada
  await page.goto(semanaUrl);
  await expect(page.getByText("previsto 2 · real 2")).toBeVisible();
  await expect(page.getByLabel("Montar tubulação linha 3")).toHaveValue("material");
  await page.getByRole("button", { name: "Encerrar semana" }).click();
  await expect(page.getByText("Encerrada", { exact: true })).toBeVisible();
  await expect(page.getByText("PPC da semana", { exact: true })).toBeVisible();
  await expect(page.getByText("0% — 0 de 1")).toBeVisible();
  await expect(page.getByText("Causa: Falta material")).toBeVisible();

  // Análise usa o PPC da programação
  await page.request.get(`${obraUrl}/analise`);
  await page.goto(`${obraUrl}/analise`);
  const indicadores = page.locator("section[aria-labelledby='titulo-indicadores']");
  await expect(indicadores.getByText("0 de 1 atividades")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver programação" })).toBeVisible();
});
