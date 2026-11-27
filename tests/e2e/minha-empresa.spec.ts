import { expect, test } from "@playwright/test";
import { criarUsuarioTeste, removerUsuarioTeste, type UsuarioTeste } from "../integracao/ajuda";

test.skip(process.env.SUPABASE_TEST !== "1", "E2E usa o Supabase de desenvolvimento (SUPABASE_TEST=1)");

let u: UsuarioTeste | undefined;
test.afterAll(async () => {
  if (u) await removerUsuarioTeste(u.userId);
});

test("Minha empresa: troca o nome, salva sozinho e exige o nome", async ({ page }) => {
  test.setTimeout(90_000);
  u = await criarUsuarioTeste();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(u.email);
  await page.getByLabel("Senha").fill(u.senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/obras");

  await page.getByRole("link", { name: "Minha empresa" }).click();
  await page.waitForURL("**/empresa");
  await expect(page.getByText("Trocar o logo do Frentia pelo da sua empresa: disponível no plano pago (em breve)")).toBeVisible();
  const campo = page.getByLabel("Nome da empresa (aparece no RDO)");
  await campo.fill("Construtora Aurora");
  await expect(page.getByText("Salvo ✓")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Nome da empresa (aparece no RDO)")).toHaveValue("Construtora Aurora");

  await page.getByLabel("Nome da empresa (aparece no RDO)").fill("");
  await expect(page.getByText("Informe o nome da empresa.")).toBeVisible();
});
