import { devices, expect, test } from "@playwright/test";
import { adicionarAtividade } from "@/lib/db/atividades";
import { criarObra } from "@/lib/db/obras";
import { aplicarAcao, criarTurno } from "@/lib/db/turnos";
import { salvarExecucao } from "@/lib/db/campo";
import { criarUsuarioTeste, removerUsuarioTeste, VAZIO, type UsuarioTeste } from "../integracao/ajuda";

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

test("causa só na hora certa: sem aviso durante o dia, cobrada no Terminei e no Fechar", async ({ browser, request }) => {
  test.setTimeout(300_000);
  u = await criarUsuarioTeste();
  const obra = exigir(await criarObra(u.cliente, { nome: "Obra Causa E2E" }));
  const { data: r, error } = await u.cliente.from("responsaveis").insert({ obra_id: obra.id, nome: "Ana" }).select("id").single();
  if (error || !r) throw new Error(error?.message);
  const ana = r.id as string;
  const turno = exigir(await criarTurno(u.cliente, {
    obra_id: obra.id, data: hojeSP(), periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00",
  }));
  const a = exigir(await adicionarAtividade(u.cliente, turno.id, { descricao: "Montagem de tubulação", unidade: "tubo", qtd_planejada: 8 }));
  await u.cliente.from("atividades").update({ responsavel_id: ana }).eq("id", a.id);
  const { token } = exigir(await aplicarAcao(u.cliente, turno.id, "liberar")) as { token: string };

  const urlAna = `/t/${token}?r=${ana}`;
  await Promise.all([request.get("/login"), request.get(urlAna)]);
  // Planejador abre o turno antes: next dev recarrega as páginas abertas ao compilar uma rota nova.
  const pl = await browser.newPage();
  await pl.goto("/login");
  await pl.getByLabel("E-mail").fill(u.email);
  await pl.getByLabel("Senha").fill(u.senha);
  await pl.getByRole("button", { name: "Entrar" }).click();
  await pl.waitForURL("**/obras");
  await pl.goto(`/obras/${obra.id}/turnos/${turno.id}`);
  // "ir" do "O que falta" abre "Corrigir execução" (recolhido) e leva ao campo da quantidade.
  await pl.getByRole("button", { name: "Ir para: Montagem de tubulação" }).click();
  await expect(pl.locator("[id^='qtd-']").first()).toBeFocused();
  await expect(pl.locator("[id^='qtd-']").first()).toBeInViewport();

  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  const cel = await ctx.newPage();
  await cel.goto(urlAna);
  const card = cel.locator("section[aria-labelledby='titulo-atividades'] > div").nth(0);
  await card.getByLabel(/Total feito hoje/).fill("3");
  await expect(card.getByText("Salvo ✓")).toBeVisible({ timeout: 15_000 });

  // Durante o dia: nada de aviso nem campo de causa.
  await expect(cel.getByText(/Informe a causa/)).toHaveCount(0);
  await expect(cel.getByLabel("Causa do não cumprimento")).toHaveCount(0);

  // Terminei cobra a causa e não registra.
  await cel.getByRole("button", { name: "✓ Terminei minha parte" }).click();
  await expect(cel.getByText("Antes de terminar, informe a causa em:")).toBeVisible();
  await expect(cel.getByText("Montagem de tubulação (3 de 8 tubos)")).toBeVisible();
  await expect(cel.getByText(/Você avisou que terminou/)).toHaveCount(0);
  await cel.getByRole("button", { name: "Ir para a causa: Montagem de tubulação" }).click();
  await expect(cel.getByLabel("Causa do não cumprimento")).toBeFocused();

  // Planejador: a lista só aparece ao tocar "Fechar turno" (no alto); Confirmar não aparece.
  await pl.reload();
  await expect(pl.getByText("Antes de fechar, informe a causa em:")).toHaveCount(0);
  await pl.getByRole("button", { name: "Fechar turno" }).click();
  await expect(pl.getByText("Antes de fechar, informe a causa em:")).toBeVisible();
  await expect(pl.getByRole("button", { name: "Confirmar fechamento" })).toHaveCount(0);
  // O "ir" abre "Corrigir execução" (recolhido) e leva até o campo.
  await expect(pl.getByText("Corrigir execução", { exact: true })).toBeVisible();
  await pl.getByRole("button", { name: "Ir para a causa: Montagem de tubulação" }).click();
  await expect(pl.getByLabel("Causa do não cumprimento")).toBeFocused();
  await expect(pl.getByLabel("Causa do não cumprimento")).toBeInViewport();
  // Cancelar e tocar de novo volta a mostrar a lista.
  await pl.getByRole("button", { name: "Cancelar" }).click();
  await expect(pl.getByText("Antes de fechar, informe a causa em:")).toHaveCount(0);
  await pl.getByRole("button", { name: "Fechar turno" }).click();
  await expect(pl.getByText("Antes de fechar, informe a causa em:")).toBeVisible();

  // Ana informa a causa e termina.
  await cel.getByLabel("Causa do não cumprimento").selectOption({ label: "Falta material" });
  await expect(card.getByText("Salvo ✓")).toBeVisible({ timeout: 15_000 });
  await expect(cel.getByText("Antes de terminar, informe a causa em:")).toHaveCount(0);
  await cel.getByRole("button", { name: "✓ Terminei minha parte" }).click();
  await expect(cel.getByText(/Você avisou que terminou às \d\d:\d\d/)).toBeVisible();
  await expect(cel.getByText("salvando…")).toHaveCount(0);
  await ctx.close();
});

test("servidor recusa o Terminei (outro celular baixou a quantidade): a tela cobra a causa", async ({ browser, request }) => {
  test.setTimeout(300_000);
  const v = await criarUsuarioTeste();
  try {
    const obra = exigir(await criarObra(v.cliente, { nome: "Obra Recusa E2E" }));
    const { data: r } = await v.cliente.from("responsaveis").insert({ obra_id: obra.id, nome: "Rita" }).select("id").single();
    const rita = r!.id as string;
    const turno = exigir(await criarTurno(v.cliente, {
      obra_id: obra.id, data: hojeSP(), periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00",
    }));
    const a = exigir(await adicionarAtividade(v.cliente, turno.id, { descricao: "Pintura", unidade: "m²", qtd_planejada: 10 }));
    await v.cliente.from("atividades").update({ responsavel_id: rita }).eq("id", a.id);
    const { token } = exigir(await aplicarAcao(v.cliente, turno.id, "liberar")) as { token: string };
    exigir(await salvarExecucao(token, a.id, { qtd_realizada: 10, causa: null, observacao: null }, VAZIO, rita));
    const url = `/t/${token}?r=${rita}`;
    await request.get(url);
    const ctx = await browser.newContext({ ...devices["Pixel 7"] });
    const cel = await ctx.newPage();
    await cel.goto(url);
    await expect(cel.getByText("Concluída", { exact: true })).toBeVisible();
    // Outro celular da equipe baixa para 6 sem causa.
    exigir(await salvarExecucao(token, a.id, { qtd_realizada: 6, causa: null, observacao: null },
      { qtd_realizada: 10, causa: null, observacao: null }, rita));
    await cel.getByRole("button", { name: "✓ Terminei minha parte" }).click();
    await expect(cel.getByText("Antes de terminar, informe a causa em:")).toBeVisible({ timeout: 20_000 });
    await expect(cel.getByText("Pintura (6 de 10 m²)")).toBeVisible();
    await expect(cel.getByLabel("Causa do não cumprimento")).toBeVisible();
    await ctx.close();
  } finally {
    await removerUsuarioTeste(v.userId);
  }
});
