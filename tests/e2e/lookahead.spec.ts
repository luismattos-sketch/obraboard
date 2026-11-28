import { expect, test } from "@playwright/test";
import { limparUsuario, prepararUsuario, type UsuarioE2E } from "./preparar";

test.skip(process.env.SUPABASE_TEST !== "1", "E2E usa o Supabase de desenvolvimento (SUPABASE_TEST=1)");

let usuario: UsuarioE2E | undefined;
test.afterAll(async () => {
  if (usuario) await limparUsuario(usuario.userId);
});

/** Segunda-feira da semana seguinte à de hoje (fuso de São Paulo), em ISO e dd/mm/aaaa. */
function proximaSegunda() {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 7);
  const s = d.toISOString().slice(0, 10);
  const br = (x: Date) => `${String(x.getUTCDate()).padStart(2, "0")}/${String(x.getUTCMonth() + 1).padStart(2, "0")}/${x.getUTCFullYear()}`;
  const qua = new Date(d);
  qua.setUTCDate(d.getUTCDate() + 2);
  const sex = new Date(d);
  sex.setUTCDate(d.getUTCDate() + 4);
  return { iso: s, quarta: br(qua), sexta: br(sex) };
}

test("lookahead: importar CSV, reimportar, item manual e levar para a semana", async ({ page }) => {
  usuario = await prepararUsuario();
  page.on("dialog", (d) => d.accept());
  const seg = proximaSegunda();

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(usuario.email);
  await page.getByLabel("Senha").fill(usuario.senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/obras");
  await page.getByRole("main").getByRole("link", { name: "Nova obra" }).click();
  await page.getByLabel("Nome da obra").fill("Obra Lookahead E2E");
  await page.getByLabel("Cidade (para o clima)").fill("Maca");
  await page.getByRole("button", { name: "Macaé, Rio de Janeiro" }).click();
  await page.getByRole("button", { name: "Criar obra" }).click();
  await expect(page.getByRole("heading", { name: "Obra Lookahead E2E" })).toBeVisible();

  await page.getByRole("complementary", { name: "Menu" }).getByRole("link", { name: "Lookahead", exact: true }).click();
  await page.waitForURL("**/lookahead");
  await expect(page.getByText("Nenhum cronograma importado")).toBeVisible();

  // CSV do Excel pt-BR: ponto e vírgula, Latin-1, datas com dia da semana e hora.
  const csv = (linhas: string[]) => Buffer.from(["EDT;Nome da tarefa;Início;Término;Quantidade;Unidade", ...linhas].join("\r\n"), "latin1");
  const subir = async (nome: string, linhas: string[]) => {
    await page.getByRole("button", { name: "Subir cronograma" }).click();
    await page.getByLabel("Arquivo do cronograma (.xlsx ou .csv)").setInputFiles({ name: nome, mimeType: "text/csv", buffer: csv(linhas) });
  };
  await subir("crono-v1.csv", [
    `1.1;Montar tubulação linha 3;qua ${seg.quarta} 07:00;sex ${seg.sexta} 17:00;120;m`,
    `1.2;Pintura do suporte;${seg.quarta};${seg.sexta};;`,
    `;Linha sem código;${seg.quarta};${seg.sexta};;`,
  ]);
  await expect(page.getByText("2 novos · 0 atualizados · 0 saem do cronograma")).toBeVisible();
  await expect(page.getByText("1 linhas ignoradas")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar importação" }).click();
  await expect(page.getByText("Cronograma importado: 2 novos")).toBeVisible();
  await expect(page.getByText("Montar tubulação linha 3")).toBeVisible();

  // Reimportar: 1.2 sai do cronograma, 1.1 muda.
  await subir("crono-v2.csv", [`1.1;Montar tubulação linha 3 (rev.);${seg.quarta};${seg.sexta};120;m`]);
  await expect(page.getByText("0 novos · 1 atualizados · 1 saem do cronograma")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar importação" }).click();
  await expect(page.getByText("Montar tubulação linha 3 (rev.)")).toBeVisible();
  await expect(page.getByText("Pintura do suporte")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Mostrar removidos (1)" })).toBeVisible();

  // Item manual
  await page.getByRole("button", { name: "Adicionar item" }).click();
  await page.getByLabel("Descrição").fill("Liberar PT da área 2");
  await page.getByLabel("Início").fill(seg.iso);
  await page.getByLabel("Término").fill(seg.iso);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Liberar PT da área 2")).toBeVisible();
  await expect(page.getByText("Manual").first()).toBeVisible();

  // Levar para a semana
  const item = page.getByRole("listitem").filter({ hasText: "Montar tubulação linha 3 (rev.)" }).first();
  await item.getByRole("button", { name: "Levar para esta semana" }).click();
  await page.waitForURL(`**/programacao/${seg.iso}?item=*`);
  await expect(page.getByRole("heading", { name: "Do lookahead" })).toBeVisible();
  await expect(page.getByLabel("Descrição")).toHaveValue("Montar tubulação linha 3 (rev.)");
  await expect(page.getByLabel("Meta da semana")).toHaveValue("120");
  await page.getByRole("button", { name: "Adicionar atividade" }).click();
  await expect(page.getByText("Cronograma: 1.1")).toBeVisible();

  await page.goto(page.url().replace(/\/programacao\/.*/, "/lookahead"));
  await expect(page.getByText(/Na semana de/).first()).toBeVisible();
});
