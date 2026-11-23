import { devices, expect, test } from "@playwright/test";
import { criarObra } from "@/lib/db/obras";
import { criarRascunho, programarSemana, salvarAtividadeProgramada } from "@/lib/db/programacao";
import { aplicarAcao, criarTurno } from "@/lib/db/turnos";
import { inicioDaSemana } from "@/lib/dominio/analise";
import { diaDaSemana, type DiaSemana } from "@/lib/dominio/programacao";
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

test("efetivo da Ana começa com a equipe prevista e só grava ao confirmar; −/+ ajusta", async ({ browser, request }) => {
  test.setTimeout(240_000);
  const hoje = hojeSP();
  const inicio = inicioDaSemana(hoje);
  const dia = diaDaSemana(inicio, hoje)! as DiaSemana;
  u = await criarUsuarioTeste();
  const obra = exigir(await criarObra(u.cliente, { nome: "Obra Efetivo Previsto E2E" }));
  const { data: r } = await u.cliente.from("responsaveis").insert({ obra_id: obra.id, nome: "Ana Souza" }).select("id").single();
  const ana = r!.id as string;
  const semana = exigir(await criarRascunho(u.cliente, obra.id, inicio));
  exigir(await salvarAtividadeProgramada(u.cliente, semana.id, {
    descricao: "Solda da linha 4", unidade: "jt", meta: 10, dias: [dia], periodo: "diurno",
    equipe: [{ funcao: "Soldador", quantidade: 2 }], responsavel_id: ana,
  }));
  exigir(await programarSemana(u.cliente, semana.id));
  const turno = exigir(await criarTurno(u.cliente, { obra_id: obra.id, data: hoje, periodo: "diurno", hora_inicio_prevista: "07:00", hora_fim_prevista: "17:00" }));
  const { token } = exigir(await aplicarAcao(u.cliente, turno.id, "liberar")) as { token: string };
  await request.get(`/t/${token}?r=${ana}`);
  const efetivoNoBanco = async () =>
    ((await criarClienteAdmin().from("efetivo").select("funcao, quantidade").eq("turno_id", turno.id)).data ?? []);

  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  const cel = await ctx.newPage();
  await cel.goto(`/t/${token}?r=${ana}`);
  await expect(cel.getByText("Equipe prevista: 2 Soldador")).toBeVisible();
  await expect(cel.getByText("Previsto pela programação — confirme ou ajuste")).toBeVisible();
  await expect(cel.getByLabel("Quantidade")).toHaveValue("2");
  expect(await efetivoNoBanco()).toEqual([]);

  await cel.getByRole("button", { name: "Confirmar equipe" }).click();
  await expect(cel.getByText("Previsto pela programação — confirme ou ajuste")).toBeHidden();
  await expect.poll(efetivoNoBanco, { timeout: 20_000 }).toEqual([{ funcao: "Soldador", quantidade: 2 }]);

  await cel.getByRole("button", { name: "Aumentar" }).click();
  await expect.poll(efetivoNoBanco, { timeout: 20_000 }).toEqual([{ funcao: "Soldador", quantidade: 3 }]);
  await cel.reload();
  await expect(cel.getByLabel("Quantidade")).toHaveValue("3");
  await expect(cel.getByText("Previsto pela programação — confirme ou ajuste")).toBeHidden();
  await ctx.close();
});
