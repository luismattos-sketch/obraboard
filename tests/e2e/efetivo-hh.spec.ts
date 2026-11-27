import { devices, expect, test } from "@playwright/test";
import { adicionarAtividade } from "@/lib/db/atividades";
import { salvarEfetivo } from "@/lib/db/campo";
import { criarObra } from "@/lib/db/obras";
import { gerarLinkQuadro } from "@/lib/db/quadro";
import { aplicarAcao, criarTurno, obterTurnoCompleto } from "@/lib/db/turnos";
import { resumirTurno } from "@/lib/dominio/resumo";
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

test("Rita empresta 2 para Ana pelo link → quadro e RDO com 11 pessoas", async ({ browser, request }) => {
  test.setTimeout(180_000);
  u = await criarUsuarioTeste();
  const obra = exigir(await criarObra(u.cliente, { nome: "Obra HH E2E" }));
  const responsavel = async (nome: string) => {
    const { data, error } = await u!.cliente.from("responsaveis").insert({ obra_id: obra.id, nome }).select("id").single();
    if (error || !data) throw new Error(error?.message);
    return data.id as string;
  };
  const rita = await responsavel("Rita");
  const ana = await responsavel("Ana");
  const turno = exigir(await criarTurno(u.cliente, {
    obra_id: obra.id, data: hojeSP(), periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00",
  }));
  for (const [descricao, resp] of [["Andaime", rita], ["Caldeiraria", ana]] as const) {
    const a = exigir(await adicionarAtividade(u.cliente, turno.id, { descricao, unidade: "m", qtd_planejada: 10 }));
    await u.cliente.from("atividades").update({ responsavel_id: resp }).eq("id", a.id);
  }
  const { token } = exigir(await aplicarAcao(u.cliente, turno.id, "liberar")) as { token: string };
  exigir(await salvarEfetivo(token, [{ funcao: "Montador de andaime", quantidade: 6 }], [], rita));
  exigir(await salvarEfetivo(token, [{ funcao: "Caldeireiro", quantidade: 5 }], [], ana));
  const { codigo } = exigir(await gerarLinkQuadro(u.cliente, obra.id));

  // Rita pelo link de campo, no celular.
  const urlRita = `/t/${token}?r=${rita}`;
  await request.get(urlRita);
  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  const cel = await ctx.newPage();
  await cel.goto(urlRita);
  await expect(cel.getByText("Lançando como")).toBeVisible();
  await expect(cel.getByText("6 pessoas · 54,0 HH")).toBeVisible();

  await cel.getByRole("button", { name: "+ Emprestar" }).click();
  await cel.getByLabel("Quantas pessoas").fill("2");
  await cel.getByLabel("Para qual equipe").selectOption({ label: "Ana" });
  await cel.getByLabel("A partir de").fill("13:00");
  await cel.getByRole("button", { name: "Registrar" }).click();
  await expect(cel.getByText("2 Montador de andaime emprestados → Ana a partir de 13:00")).toBeVisible();
  await expect(cel.getByText("salvando…")).toHaveCount(0);
  await expect(cel.getByText("6 pessoas · 46,0 HH")).toBeVisible();

  // Recarregar mantém o registro.
  await cel.reload();
  await expect(cel.getByText("2 Montador de andaime emprestados → Ana a partir de 13:00")).toBeVisible();

  // Ana vê os recebidos no link dela.
  await cel.goto(`/t/${token}?r=${ana}`);
  await expect(cel.getByText("+2 Montador de andaime (de Rita, 13:00–17:00)")).toBeVisible();
  await expect(cel.getByText("5 pessoas · 53,0 HH")).toBeVisible();
  // Ana lança o que fez: o quadro passa sozinho para o check-out (não há mais ?visao=).
  const cardAna = cel.locator("section[aria-labelledby='titulo-atividades'] > div").nth(0);
  await cardAna.getByLabel(/Total feito hoje/).fill("4");
  await expect(cardAna.getByText("Salvo ✓")).toBeVisible({ timeout: 15_000 });
  await ctx.close();

  // Quadro público (TV): check-out com o recebido na faixa da Ana.
  const tv = await browser.newPage();
  await request.get(`/q/${codigo}`);
  await tv.goto(`/q/${codigo}`);
  await expect(tv.getByText("+2 Montador de andaime (de Rita, 13:00–17:00)")).toBeVisible();
  await expect(tv.getByText("6 pessoas · 46,0 HH")).toBeVisible();
  await tv.close();

  // RDO: efetivo total 11 (não 13) e HH 99.
  const t = await obterTurnoCompleto(u.cliente, turno.id);
  const r = resumirTurno(t!);
  expect(r.efetivoTotal).toBe(11);
  expect(r.hh).toBe(99);
});
