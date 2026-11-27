import { devices, expect, test } from "@playwright/test";
import { criarObra } from "@/lib/db/obras";
import { gerarLinkQuadro } from "@/lib/db/quadro";
import { criarRascunho, obterDadosSemana, programarSemana, salvarAtividadeProgramada } from "@/lib/db/programacao";
import { aplicarAcao, criarTurno } from "@/lib/db/turnos";
import { inicioDaSemana } from "@/lib/dominio/analise";
import { diaDaSemana, resumirSemana, type DiaSemana } from "@/lib/dominio/programacao";
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

test("Carlos lança serviço extra e Rita adianta a pintura pelo link → quadro, turno e semana; fecha sem pedir causa", async ({ browser, request }) => {
  test.setTimeout(480_000);
  const hoje = hojeSP();
  const inicio = inicioDaSemana(hoje);
  const dia = diaDaSemana(inicio, hoje)!;
  test.skip(dia === 6, "Domingo: não há dia futuro na semana para adiantar");
  u = await criarUsuarioTeste();
  const obra = exigir(await criarObra(u.cliente, { nome: "Obra Extra E2E" }));
  const responsavel = async (nome: string) => {
    const { data, error } = await u!.cliente.from("responsaveis").insert({ obra_id: obra.id, nome }).select("id").single();
    if (error || !data) throw new Error(error?.message);
    return data.id as string;
  };
  const rita = await responsavel("Rita Alves");
  const carlos = await responsavel("Carlos Pereira");
  const semana = exigir(await criarRascunho(u.cliente, obra.id, inicio));
  const futuros = [dia + 1, dia + 2].filter((d) => d <= 6) as DiaSemana[];
  exigir(await salvarAtividadeProgramada(u.cliente, semana.id, {
    descricao: "Pintura do guarda-corpo", unidade: "m²", meta: 80, dias: futuros, periodo: "diurno", equipe: [], responsavel_id: rita,
  }));
  exigir(await salvarAtividadeProgramada(u.cliente, semana.id, {
    descricao: "Cabos VTI-02", unidade: "m", meta: 60, dias: [dia as DiaSemana], periodo: "diurno", equipe: [], responsavel_id: carlos,
  }));
  exigir(await programarSemana(u.cliente, semana.id));
  const turno = exigir(await criarTurno(u.cliente, {
    obra_id: obra.id, data: hoje, periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00",
  }));
  const { token } = exigir(await aplicarAcao(u.cliente, turno.id, "liberar")) as { token: string };

  const turnoUrl = `/obras/${obra.id}/turnos/${turno.id}`;
  // O quadro é só o link público (quadro único).
  const { codigo } = exigir(await gerarLinkQuadro(u.cliente, obra.id));
  const quadroUrl = `/q/${codigo}?turno=${turno.id}`;
  await Promise.all([request.get("/login"), request.get(`/t/${token}?r=${carlos}`)]);
  // Planejador abre o turno antes: next dev recarrega as páginas abertas ao compilar uma rota nova.
  const pl = await browser.newPage();
  await pl.goto("/login");
  await pl.getByLabel("E-mail").fill(u.email);
  await pl.getByLabel("Senha").fill(u.senha);
  await pl.getByRole("button", { name: "Entrar" }).click();
  await pl.waitForURL("**/obras");
  await pl.goto(quadroUrl);
  await pl.goto(turnoUrl);

  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  const cel = await ctx.newPage();
  const cartao = (texto: string) => cel.locator("section[aria-labelledby='titulo-atividades'] > div").filter({ hasText: texto });

  // Carlos: conclui os cabos e lança o extra.
  await cel.goto(`/t/${token}?r=${carlos}`);
  await expect(cel.getByText("Lançando como")).toBeVisible();
  await cartao("Cabos VTI-02").getByRole("button", { name: /Marcar como concluída/ }).click();
  await expect(cartao("Cabos VTI-02").getByText("Salvo ✓")).toBeVisible({ timeout: 20_000 });
  await cel.getByRole("button", { name: "+ Serviço extra (fora da programação)" }).click();
  await cel.getByLabel("Descrição").fill("Troca de iluminação da plataforma 3");
  await cel.getByLabel("Quantidade feita").fill("12");
  await cel.getByLabel("Unidade").fill("un");
  await cel.getByRole("button", { name: "Lançar serviço extra" }).click();
  await expect(cel.getByText("Serviço extra lançado.")).toBeVisible({ timeout: 20_000 });
  await expect(cel.getByRole("link", { name: "Avisar o planejador no WhatsApp" })).toHaveAttribute("href", /wa\.me\/\?text=.*Extra/);
  await expect(cartao("Troca de iluminação da plataforma 3")).toContainText("lançado por você", { timeout: 20_000 });
  await expect(cartao("Troca de iluminação da plataforma 3")).toContainText("Extra");

  // Rita: sem nada hoje, aparece pela programação da semana e adianta a pintura.
  await cel.goto(`/t/${token}?r=${rita}`);
  await expect(cel.getByText("Lançando como")).toBeVisible();
  await cel.getByRole("button", { name: "+ Adiantar atividade da semana" }).click();
  await cel.getByRole("button", { name: /^Pintura do guarda-corpo — .* — saldo 80 m²$/ }).click();
  const pintura = cartao("Pintura do guarda-corpo");
  await expect(pintura).toContainText("Adiantada", { timeout: 20_000 });
  await pintura.getByLabel(/Total feito hoje/).fill("40");
  await expect(pintura.getByText("Salvo ✓")).toBeVisible({ timeout: 20_000 });
  await ctx.close();

  // Quadro do planejador: extra e adiantada à parte.
  await pl.goto(quadroUrl);
  await expect(pl.getByText("+1 extra")).toBeVisible();
  await expect(pl.getByText("+1 adiantada")).toBeVisible();

  // Turno: autor do lançamento e fechamento sem pedir causa.
  await pl.goto(turnoUrl);
  await pl.getByText("Corrigir execução", { exact: true }).click();
  await expect(pl.getByText("lançado pelo campo — Carlos Pereira")).toBeVisible();
  await expect(pl.getByText("lançado pelo campo — Rita Alves")).toBeVisible();
  await pl.getByRole("button", { name: "Fechar turno" }).click();
  await pl.getByRole("button", { name: "Confirmar fechamento" }).click();
  await expect(pl.getByRole("button", { name: "Reabrir turno" })).toBeVisible();
  await pl.close();

  // Semana: o adiantado soma no realizado da pintura.
  const r = resumirSemana(await obterDadosSemana(u.cliente, semana));
  expect(r.atividades.find((a) => a.descricao === "Pintura do guarda-corpo")?.realizado).toBe(40);
  expect(r.extras.map((x) => x.descricao)).toEqual(["Troca de iluminação da plataforma 3"]);
});
