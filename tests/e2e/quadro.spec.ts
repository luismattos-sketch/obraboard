import { devices, expect, test } from "@playwright/test";
import { limparUsuario, prepararUsuario, type UsuarioE2E } from "./preparar";

test.skip(process.env.SUPABASE_TEST !== "1", "E2E usa o Supabase de desenvolvimento (SUPABASE_TEST=1)");

let usuario: UsuarioE2E | undefined;

test.afterAll(async () => {
  if (usuario) await limparUsuario(usuario.userId);
});

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function hojeSP() {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const dia = (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
  return { iso, dia };
}

test("quadro: responsáveis, check-in, link de campo por nome e quadro público", async ({ page, browser }) => {
  test.setTimeout(180_000);
  usuario = await prepararUsuario();
  page.on("dialog", (d) => d.accept());
  const hoje = hojeSP();

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(usuario.email);
  await page.getByLabel("Senha").fill(usuario.senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/obras");

  await page.getByRole("main").getByRole("link", { name: "Nova obra" }).click();
  await page.getByLabel("Nome da obra").fill("Obra Quadro E2E");
  await page.getByRole("button", { name: "Criar obra" }).click();
  await expect(page.getByRole("heading", { name: "Obra Quadro E2E" })).toBeVisible();
  const obraUrl = page.url();

  // Responsáveis
  await page.getByText("Responsáveis (0)").click();
  for (const nome of ["Ana", "João"]) {
    await page.getByRole("button", { name: "+ Novo responsável" }).click();
    await page.getByLabel("Nome", { exact: true }).fill(nome);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(nome, { exact: true })).toBeVisible();
  }

  // Programação de hoje com uma atividade de cada responsável
  await page.request.get(`${obraUrl}/programacao/${hoje.iso}`);
  await page.goto(`${obraUrl}/programacao`);
  await page.getByLabel("Data da semana").fill(hoje.iso);
  await page.getByRole("button", { name: "Abrir semana" }).click();
  await page.waitForURL(/\/programacao\/\d{4}-\d{2}-\d{2}$/);
  for (const [descricao, nome] of [["Montagem de duto", "Ana"], ["Troca de rolos", "João"]]) {
    await page.getByLabel("Descrição").fill(descricao);
    await page.getByLabel("Meta da semana").fill("4");
    await page.getByLabel("Unidade").fill("un");
    await page.locator("label", { hasText: new RegExp(`^${DIAS[hoje.dia]}$`) }).click();
    await page.getByLabel("Responsável").selectOption({ label: nome });
    await page.getByRole("button", { name: "Adicionar atividade" }).click();
    await expect(page.getByText(descricao)).toBeVisible();
  }
  await page.getByRole("button", { name: "Programar semana" }).click();
  await expect(page.getByText("PPC da semana (provisório)")).toBeVisible();

  // Turno de hoje nasce com as atividades e os responsáveis
  await page.goto(obraUrl);
  await page.getByRole("link", { name: "Novo turno" }).click();
  await page.getByRole("button", { name: "Criar turno" }).click();
  await page.waitForURL(/\/turnos\/[0-9a-f-]{36}$/);
  const turnoUrl = page.url();

  // Quadro do planejador: check-in com as duas faixas
  await page.request.get(`${obraUrl}/quadro`);
  await page.getByRole("link", { name: "Ver quadro" }).click();
  await page.waitForURL(/\/quadro\?turno=/);
  await expect(page.getByText("CHECK-IN", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ana" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "João" })).toBeVisible();

  // Liberar = check-in registrado
  await page.goto(turnoUrl);
  await page.getByRole("button", { name: "Liberar para campo" }).click();
  await expect(page.getByRole("button", { name: "Copiar link" })).toBeVisible();
  const urlCampo = (await page.locator("p.break-all").textContent())!.trim();
  await page.reload();
  await page.getByText(/^Histórico \(/).click();
  await expect(page.getByRole("link", { name: "Check-in registrado" })).toBeVisible();

  // Link de campo: escolher o nome e lançar só a própria atividade
  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  try {
    const campo = await ctx.newPage();
    await campo.goto(urlCampo);
    await expect(campo.getByRole("heading", { name: "Quem é você?" })).toBeVisible();
    await campo.getByRole("link", { name: "Ana" }).click();
    await expect(campo.getByText("Lançando como")).toBeVisible();
    await expect(campo.getByText("Troca de rolos")).toHaveCount(0);
    const card = campo.locator("section[aria-labelledby='titulo-atividades'] > div").nth(0);
    await card.getByRole("button", { name: /Marcar como concluída/ }).click();
    await expect(card.getByText("Salvo ✓")).toBeVisible({ timeout: 15_000 });
    await expect(campo.getByText("Terminou? Avise o planejador.")).toBeVisible();

    // ?r= adulterado volta para a escolha
    await campo.goto(`${urlCampo}?r=00000000-0000-0000-0000-000000000000`);
    await expect(campo.getByRole("heading", { name: "Quem é você?" })).toBeVisible();
  } finally {
    await ctx.close();
  }

  // Link público do quadro, sem sessão: visão de check-out
  await page.goto(obraUrl);
  await page.getByRole("button", { name: "Gerar link" }).click();
  const urlQuadro = (await page.locator("p.break-all").textContent())!.trim();
  expect(urlQuadro).toMatch(/\/q\/.+/);
  const tv = await browser.newContext();
  try {
    const p = await tv.newPage();
    await p.request.get(urlQuadro);
    await p.goto(urlQuadro);
    await expect(p.getByText("CHECK-OUT", { exact: true })).toBeVisible();
    await expect(p.getByText("1 de 1 programadas · 100%")).toBeVisible();
    await expect(p.getByText("0 de 1 programadas · 0%")).toBeVisible();
    await expect(p.getByRole("link", { name: "Editar" })).toHaveCount(0);
  } finally {
    await tv.close();
  }
});
