import { devices, expect, test } from "@playwright/test";
import { adicionarAtividade } from "@/lib/db/atividades";
import { criarObra } from "@/lib/db/obras";
import { aplicarAcao, criarTurno } from "@/lib/db/turnos";
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

test("total feito hoje: somar um trecho e confirmar antes de trocar o parcial pela meta", async ({ browser, request }) => {
  test.setTimeout(240_000);
  u = await criarUsuarioTeste();
  const obra = exigir(await criarObra(u.cliente, { nome: "Obra Lançamento E2E" }));
  const turno = exigir(await criarTurno(u.cliente, {
    obra_id: obra.id, data: hojeSP(), periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00",
  }));
  exigir(await adicionarAtividade(u.cliente, turno.id, { descricao: "Lançamento de cabos", unidade: "m", qtd_planejada: 100 }));
  const { token } = exigir(await aplicarAcao(u.cliente, turno.id, "liberar")) as { token: string };

  const url = `/t/${token}`;
  await request.get(url);
  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  const cel = await ctx.newPage();
  await cel.goto(url);
  const card = cel.locator("section[aria-labelledby='titulo-atividades'] > div").nth(0);
  const total = card.getByLabel("Total feito hoje (m)");

  await expect(card.getByText("salva sozinho")).toBeVisible();
  await total.fill("40");
  await expect(card.getByText("Salvo ✓")).toBeVisible({ timeout: 15_000 });

  // Somar um trecho: prévia e total novo.
  await card.getByRole("button", { name: "+ Somar" }).click();
  await card.getByLabel("Quanto a mais?").fill("0");
  await card.getByRole("button", { name: "Somar", exact: true }).click();
  await expect(card.getByText("Digite um número válido")).toBeVisible();
  await expect(total).toHaveValue("40");
  await card.getByLabel("Quanto a mais?").fill("30");
  await expect(card.getByText("40 + 30 = 70 m")).toBeVisible();
  await card.getByRole("button", { name: "Somar", exact: true }).click();
  await expect(total).toHaveValue("70");
  await expect(card.getByLabel("Quanto a mais?")).toHaveCount(0);
  await expect(card.getByText("Salvo ✓")).toBeVisible({ timeout: 15_000 });

  // Concluída com parcial pergunta; Não mantém.
  // Abrir a pergunta fecha o painel de somar (nunca os dois juntos).
  await card.getByRole("button", { name: "+ Somar" }).click();
  await expect(card.getByLabel("Quanto a mais?")).toBeVisible();
  await card.getByRole("button", { name: /Marcar como concluída/ }).click();
  await expect(card.getByLabel("Quanto a mais?")).toHaveCount(0);
  await card.getByRole("button", { name: "Não", exact: true }).click();
  await card.getByRole("button", { name: /Marcar como concluída/ }).click();
  await expect(card.getByText("Trocar 70 por 100?")).toBeVisible();
  await card.getByRole("button", { name: "Não", exact: true }).click();
  await expect(total).toHaveValue("70");
  await expect(card.getByText("Trocar 70 por 100?")).toHaveCount(0);

  // Sim troca pela meta.
  await card.getByRole("button", { name: /Marcar como concluída/ }).click();
  await card.getByRole("button", { name: "Sim" }).click();
  await expect(total).toHaveValue("100");
  await expect(card.getByText("Salvo ✓")).toBeVisible({ timeout: 15_000 });
  await expect(card.getByText("Concluída", { exact: true })).toBeVisible();

  await cel.reload();
  await expect(cel.getByLabel("Total feito hoje (m)")).toHaveValue("100");
  await ctx.close();
});
