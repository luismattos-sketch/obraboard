import { devices, expect, test } from "@playwright/test";
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
const hojeSP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
function exigir<T>(r: { ok: true; dados: T } | { ok: false; erro: string }): T {
  if (!r.ok) throw new Error(r.erro);
  return r.dados;
}

test("campo: confirma o nome, Ver tudo só leitura, Iniciar turno e aviso de clima sem cidade", async ({ browser, request }) => {
  test.setTimeout(240_000);
  u = await criarUsuarioTeste();
  const obra = exigir(await criarObra(u.cliente, { nome: "Obra Permissões E2E" }));
  const admin = criarClienteAdmin();
  const ana = (await admin.from("responsaveis").insert({ obra_id: obra.id, nome: "Ana Souza" }).select("id").single()).data!.id as string;
  const joao = (await admin.from("responsaveis").insert({ obra_id: obra.id, nome: "João Lima" }).select("id").single()).data!.id as string;
  const turno = exigir(await criarTurno(u.cliente, { obra_id: obra.id, data: hojeSP(), periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00" }));
  const a = exigir(await adicionarAtividade(u.cliente, turno.id, { descricao: "Solda linha 4", unidade: "jt", qtd_planejada: 10 }));
  const b = exigir(await adicionarAtividade(u.cliente, turno.id, { descricao: "Montar suporte", unidade: "un", qtd_planejada: 4 }));
  await admin.from("atividades").update({ responsavel_id: ana }).eq("id", a.id);
  await admin.from("atividades").update({ responsavel_id: joao }).eq("id", b.id);
  const { token } = exigir(await aplicarAcao(u.cliente, turno.id, "liberar")) as { token: string };
  await admin.from("turnos").update({ hora_inicio_real: "07:10" }).eq("id", turno.id);
  await request.get(`/t/${token}`);

  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  const cel = await ctx.newPage();
  await cel.goto(`/t/${token}`);

  // Nome escolhido na lista pede confirmação; nada editável antes.
  await cel.getByRole("link", { name: "Ana Souza" }).click();
  await expect(cel.getByRole("heading", { name: "Você é Ana Souza?" })).toBeVisible();
  await expect(cel.getByText("Solda linha 4")).toBeHidden();
  await cel.getByRole("link", { name: "Não, voltar" }).click();
  await expect(cel.getByRole("heading", { name: "Quem é você?" })).toBeVisible();
  await cel.getByRole("link", { name: "Ana Souza" }).click();
  await cel.getByRole("button", { name: "Sou eu" }).click();
  await expect(cel.getByText("Lançando como")).toBeVisible();
  await expect(cel.getByText("Solda linha 4")).toBeVisible();

  // Horário: sem campo digitado; sai do Iniciar turno (o planejador tinha posto 07:10).
  await expect(cel.getByText("Início real: 07:10 · Fim real: —")).toBeVisible();
  await expect(cel.locator("#hora-inicio")).toHaveCount(0);
  await cel.getByRole("region", { name: "Início do turno" }).getByRole("button", { name: "▶ Iniciar turno" }).click();
  await expect(cel.getByRole("region", { name: "Início do turno" }).getByText(/✓ Você iniciou às \d\d:\d\d/)).toBeVisible({ timeout: 15_000 });
  await expect(cel.getByText("Início real: 07:10")).toBeHidden({ timeout: 15_000 });
  const iniciou = (await admin.from("turno_equipes_iniciadas").select("responsavel_id").eq("turno_id", turno.id)).data ?? [];
  expect(iniciou.map((x) => x.responsavel_id)).toEqual([ana]);

  // Clima: automático; obra sem cidade mostra o aviso.
  await expect(cel.getByText("Clima automático indisponível")).toBeVisible();

  // Ver tudo: vê as duas equipes, sem nada editável e sem Enviar turno.
  await cel.getByRole("link", { name: "Trocar" }).click();
  await cel.getByRole("link", { name: "Ver tudo" }).click();
  await expect(cel.getByText("Montar suporte")).toBeVisible();
  await expect(cel.getByRole("button", { name: /Enviar turno/ })).toHaveCount(0);
  await expect(cel.getByRole("button", { name: /Iniciar turno/ })).toHaveCount(0);
  await expect(cel.locator("main input:not([disabled]), main select:not([disabled]), main textarea:not([disabled])")).toHaveCount(0);
  await ctx.close();
});
