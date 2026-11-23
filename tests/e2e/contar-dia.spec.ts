import { devices, expect, test } from "@playwright/test";
import { adicionarAtividade } from "@/lib/db/atividades";
import { criarObra } from "@/lib/db/obras";
import { aplicarAcao, criarTurno } from "@/lib/db/turnos";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarUsuarioTeste, removerUsuarioTeste, type UsuarioTeste } from "../integracao/ajuda";

// A IA é a falsa (FRENTIA_IA_FALSA=1 no webServer do playwright.config.ts): nada é cobrado.
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

test("conte como foi o dia: prévia, pergunta, lançar e o planejador vê o texto", async ({ browser, request }) => {
  test.setTimeout(300_000);
  u = await criarUsuarioTeste();
  const obra = exigir(await criarObra(u.cliente, { nome: "Obra Contar E2E" }));
  const { data: r, error } = await u.cliente.from("responsaveis").insert({ obra_id: obra.id, nome: "Ana" }).select("id").single();
  if (error || !r) throw new Error(error?.message);
  const ana = r.id as string;
  const turno = exigir(await criarTurno(u.cliente, {
    obra_id: obra.id, data: hojeSP(), periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00",
  }));
  const a = exigir(await adicionarAtividade(u.cliente, turno.id, { descricao: "Tubulação linha 3", unidade: "m", qtd_planejada: 50 }));
  const b = exigir(await adicionarAtividade(u.cliente, turno.id, { descricao: "Suporte de tubo", unidade: "un", qtd_planejada: 8 }));
  await u.cliente.from("atividades").update({ responsavel_id: ana }).in("id", [a.id, b.id]);
  const { token } = exigir(await aplicarAcao(u.cliente, turno.id, "liberar")) as { token: string };

  const urlAna = `/t/${token}?r=${ana}`;
  await Promise.all([request.get("/login"), request.get(urlAna)]);
  const pl = await browser.newPage();
  await pl.goto("/login");
  await pl.getByLabel("E-mail").fill(u.email);
  await pl.getByLabel("Senha").fill(u.senha);
  await pl.getByRole("button", { name: "Entrar" }).click();
  await pl.waitForURL("**/obras");
  await pl.goto(`/obras/${obra.id}/turnos/${turno.id}`);

  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  const cel = await ctx.newPage();
  await cel.goto(urlAna);
  const caixa = cel.locator("section[aria-labelledby='titulo-contar-dia']");
  await expect(caixa.getByRole("heading", { name: "Conte como foi o dia" })).toBeVisible();

  // IA fora do ar: avisa e o texto fica guardado, inclusive ao recarregar.
  await caixa.getByRole("textbox").fill("ERRO teste");
  await caixa.getByRole("button", { name: "Organizar" }).click();
  await expect(caixa.getByText("Não deu para organizar agora — tente de novo ou lance nos cards.")).toBeVisible();
  await cel.reload();
  await expect(caixa.getByRole("textbox")).toHaveValue("ERRO teste");

  // Organizar → prévia com uma pergunta; Lançar só depois da resposta.
  await caixa.getByRole("textbox").fill("fizemos 30 m de tubulação, faltou andaime");
  await caixa.getByRole("button", { name: "Organizar" }).click();
  await expect(caixa.getByText("A IA entendeu:")).toBeVisible();
  await expect(caixa.getByText("Tubulação linha 3 — 0 → 30 m de 50 m (parcial)")).toBeVisible();
  await expect(caixa.getByText("Suporte de tubo — você não falou nada (fica como está)")).toBeVisible();
  await expect(caixa.getByRole("button", { name: "Lançar" })).toBeDisabled();

  // Corrigir texto volta sem gravar nada.
  await caixa.getByRole("button", { name: "Corrigir texto" }).click();
  await expect(caixa.getByRole("textbox")).toHaveValue("fizemos 30 m de tubulação, faltou andaime");
  await caixa.getByRole("button", { name: "Organizar" }).click();
  await expect(caixa.getByText("Andaime é…")).toBeVisible();
  await caixa.getByRole("button", { name: "Falta material" }).click();
  await caixa.getByRole("button", { name: "Lançar" }).click();
  await expect(caixa.getByText("Lançado ✓ — confira nos cards abaixo.")).toBeVisible({ timeout: 30_000 });

  const card = cel.locator("section[aria-labelledby='titulo-atividades'] > div").nth(0);
  await expect(card.getByLabel(/Total feito hoje/)).toHaveValue("30");
  const { data: gravada } = await criarClienteAdmin().from("atividades").select("qtd_realizada, causa, observacao").eq("id", a.id).single();
  expect(gravada).toEqual({ qtd_realizada: 30, causa: "material", observacao: "faltou andaime" });
  await cel.reload();
  await expect(caixa.getByRole("textbox")).toHaveValue("");

  // Planejador vê o texto original.
  await pl.reload();
  await pl.getByText("O que o campo escreveu (1)").click();
  await expect(pl.getByText("fizemos 30 m de tubulação, faltou andaime")).toBeVisible();
  await expect(pl.getByText("lançado", { exact: true })).toBeVisible();
  await ctx.close();
});
