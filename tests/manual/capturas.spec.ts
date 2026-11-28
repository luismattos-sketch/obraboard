// Roteiro das capturas do manual: monta a obra de exemplo e fotografa cada passo de lib/ajuda/.
// Rodar: SUPABASE_TEST=1 npm run manual:capturas   (um capítulo só: MANUAL_CAPITULO=check-in ...)
import { devices, expect, test, type Browser, type Page } from "@playwright/test";
import { criarRascunho, programarSemana, salvarAtividadeProgramada, obterSemana } from "@/lib/db/programacao";
import { inicioDaSemana } from "@/lib/dominio/analise";
import { diaDaSemana, somarDias, type DiaSemana } from "@/lib/dominio/programacao";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarUsuarioTeste, removerUsuarioTeste, type UsuarioTeste } from "../integracao/ajuda";
import { fotografar, naoFotografados } from "./fotografar";
import { ATIVIDADE_NA_TELA, diasAteHoje, OBRA, OUTRAS_ATIVIDADES, RESPONSAVEIS, type NomeResponsavel } from "./obraExemplo";

test.skip(process.env.SUPABASE_TEST !== "1", "Capturas usam o Supabase de desenvolvimento (SUPABASE_TEST=1)");

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const hojeSP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

let u: UsuarioTeste | undefined;
test.afterAll(async () => {
  if (u) await removerUsuarioTeste(u.userId);
});

async function entrar(page: Page, usuario: UsuarioTeste) {
  page.on("dialog", (d) => void d.accept());
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(usuario.email);
  await page.getByLabel("Senha").fill(usuario.senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/obras");
}

async function celular(browser: Browser) {
  const ctx = await browser.newContext({ ...devices["Pixel 7"], locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const page = await ctx.newPage();
  page.on("dialog", (d) => void d.accept());
  return page;
}

test("capturas do manual", async ({ browser, page: pl, request }) => {
  test.setTimeout(900_000);
  const hoje = hojeSP();
  const inicio = inicioDaSemana(hoje);
  const dia = diaDaSemana(inicio, hoje)! as DiaSemana;
  u = await criarUsuarioTeste();
  const c = u.cliente;
  // Nome fictício no menu (sem ele, aparece o e-mail de teste).
  await criarClienteAdmin().auth.admin.updateUserById(u.userId, { user_metadata: { nome: "Paula Ribeiro" } });
  // next dev compila cada rota no 1º acesso e recarrega as páginas abertas: aquece tudo antes.
  for (const r of ["/login", "/ajuda", "/ajuda/check-in", "/obras/nova", "/t/x", "/q/x"]) await request.get(r);
  await entrar(pl, u);
  const aquecer = async (caminhos: string[]) => {
    for (const r of caminhos) await pl.request.get(r);
  };

  // ---------- Primeiros passos ----------
  await pl.goto("/empresa");
  await pl.getByLabel("Nome da empresa (aparece no RDO)").fill("Montagens Exemplo Ltda");
  await expect(pl.getByText("Salvo ✓")).toBeVisible();
  await fotografar(pl, "primeiros-passos", "minha-empresa");
  await pl.goto("/obras/nova");
  await pl.getByLabel("Nome da obra").fill(OBRA.nome);
  await pl.getByLabel("Cliente (opcional)").fill(OBRA.cliente);
  await pl.getByLabel("Endereço (opcional)").fill(OBRA.endereco);
  await fotografar(pl, "primeiros-passos", "criar-obra");
  await pl.getByLabel("Cidade (para o clima)").fill("Maca");
  await pl.getByRole("button", { name: "Macaé, Rio de Janeiro" }).click();
  await pl.getByRole("button", { name: "Criar obra" }).click();
  await expect(pl.getByRole("heading", { name: OBRA.nome })).toBeVisible();
  const obraId = /\/obras\/([0-9a-f-]{36})/.exec(pl.url())![1];
  const obraUrl = `/obras/${obraId}`;
  await aquecer([`${obraUrl}/programacao`, `${obraUrl}/programacao/${inicio}`, `${obraUrl}/turnos/novo`, `${obraUrl}/quadro`,
    `${obraUrl}/analise`, `${obraUrl}/rdos`, "/ajuda/nao-existe"]);

  const ids = {} as Record<NomeResponsavel, string>;
  for (const nome of RESPONSAVEIS) {
    const { data, error } = await c.from("responsaveis").insert({ obra_id: obraId, nome }).select("id").single();
    if (error || !data) throw new Error(error?.message);
    ids[nome] = data.id as string;
  }
  await pl.reload();
  await pl.getByText(/^Responsáveis \(\d+\)/).click();
  await fotografar(pl, "primeiros-passos", "responsaveis");
  await pl.getByRole("button", { name: "Gerar link" }).click();
  await expect(pl.getByRole("button", { name: "Gerar novo link" }).first()).toBeVisible();
  await fotografar(pl, "primeiros-passos", "link-quadro");

  // Item 1.6: semana anterior programada com uma atividade que ficou com saldo (aparece em "Trazer").
  const anterior = await criarRascunho(c, obraId, somarDias(inicio, -7));
  if (!anterior.ok) throw new Error(anterior.erro);
  const pintura = await salvarAtividadeProgramada(c, anterior.dados.id, {
    descricao: "Pintura do galpão", local: "Galpão 2", unidade: "m²", meta: 120, dias: [0, 1, 2, 3, 4], periodo: "diurno",
    responsavel_id: ids[RESPONSAVEIS[0]], equipe: [{ funcao: "Pintor", quantidade: 3 }],
  });
  if (!pintura.ok) throw new Error(pintura.erro);
  const prog = await programarSemana(c, anterior.dados.id);
  if (!prog.ok) throw new Error(prog.erro);

  // ---------- Programar a semana ----------
  await pl.goto(`${obraUrl}/programacao`);
  await fotografar(pl, "programar-semana", "abrir-programacao");
  await pl.getByLabel("Data da semana").fill(hoje);
  await pl.getByRole("button", { name: "Abrir semana" }).click();
  await pl.waitForURL(`**/programacao/${inicio}`);
  await expect(pl.getByRole("button", { name: "Trazer" })).toBeVisible();
  await fotografar(pl, "programar-semana", "trazer-semana-anterior");
  const dias = diasAteHoje(dia);
  await pl.getByLabel("Descrição").fill(ATIVIDADE_NA_TELA.descricao);
  await pl.getByLabel("Local (opcional)").fill(ATIVIDADE_NA_TELA.local);
  await pl.getByLabel("Unidade").fill(ATIVIDADE_NA_TELA.unidade);
  await pl.getByLabel("Meta da semana").fill(ATIVIDADE_NA_TELA.meta);
  for (const d of dias) await pl.locator("label", { hasText: new RegExp(`^${DIAS[d]}$`) }).click();
  await pl.getByLabel("Função", { exact: true }).fill(ATIVIDADE_NA_TELA.funcao);
  await pl.getByLabel("Qtd").fill(ATIVIDADE_NA_TELA.qtd);
  await pl.getByLabel("Responsável").selectOption({ label: ATIVIDADE_NA_TELA.responsavel });
  await fotografar(pl, "programar-semana", "adicionar-atividade");
  await pl.getByRole("button", { name: "Adicionar atividade" }).click();
  await expect(pl.getByText(ATIVIDADE_NA_TELA.descricao).first()).toBeVisible();
  const semana = (await obterSemana(c, obraId, inicio))!;
  for (const a of OUTRAS_ATIVIDADES) {
    const r = await salvarAtividadeProgramada(c, semana.id, {
      descricao: a.descricao, local: a.local, unidade: a.unidade, meta: a.meta, dias, periodo: "diurno",
      responsavel_id: ids[a.responsavel], equipe: a.equipe,
    });
    if (!r.ok) throw new Error(r.erro);
  }
  // Item 19: a tubulação continua no turno da noite (sequência).
  const { data: tubulacao } = await c
    .from("programacao_atividades").select("id").eq("semana_id", semana.id).eq("descricao", ATIVIDADE_NA_TELA.descricao).single();
  const noite = await salvarAtividadeProgramada(c, semana.id, {
    descricao: ATIVIDADE_NA_TELA.descricao, local: ATIVIDADE_NA_TELA.local, unidade: ATIVIDADE_NA_TELA.unidade,
    meta: Number(ATIVIDADE_NA_TELA.meta), dias, periodo: "noturno", responsavel_id: ids[OUTRAS_ATIVIDADES[0].responsavel],
    equipe: [{ funcao: ATIVIDADE_NA_TELA.funcao, quantidade: Number(ATIVIDADE_NA_TELA.qtd) }], continua_de: tubulacao!.id as string,
  });
  if (!noite.ok) throw new Error(noite.erro);
  await pl.reload();
  await fotografar(pl, "programar-semana", "continuar-proximo-turno");
  await fotografar(pl, "programar-semana", "programar");
  await pl.getByRole("button", { name: "Programar semana" }).click();
  await expect(pl.getByText("Programada", { exact: true })).toBeVisible();

  // ---------- Check-in ----------
  await pl.goto(`${obraUrl}/turnos/novo`);
  await pl.getByLabel("Data").fill(hoje);
  await pl.getByLabel("Início previsto").fill("07:00");
  await pl.getByLabel("Fim previsto").fill("17:00");
  await fotografar(pl, "check-in", "novo-turno");
  await pl.getByRole("button", { name: "Criar turno" }).click();
  await pl.waitForURL(/\/turnos\/[0-9a-f-]{36}$/);
  const turnoId = /\/turnos\/([0-9a-f-]{36})/.exec(pl.url())![1];
  const turnoUrl = `${obraUrl}/turnos/${turnoId}`;
  await aquecer([turnoUrl, `${obraUrl}/quadro?turno=${turnoId}`]);
  const efetivo = [
    { funcao: "Encanador", quantidade: 3, responsavel_id: ids["Ana Souza"] },
    { funcao: "Pedreiro", quantidade: 2, responsavel_id: ids["Ana Souza"] },
    { funcao: "Pintor", quantidade: 2, responsavel_id: ids["João Lima"] },
    { funcao: "Eletricista", quantidade: 2, responsavel_id: ids["Carlos Pereira"] },
    { funcao: "Montador", quantidade: 2, responsavel_id: ids["Carlos Pereira"] },
  ];
  const { error: erroEfetivo } = await c.from("efetivo").insert(efetivo.map((e) => ({ ...e, turno_id: turnoId })));
  if (erroEfetivo) throw new Error(erroEfetivo.message);
  // Todas confirmadas menos a primeira: a captura mostra o selo "Confirmada" e o botão "Confirmar".
  const { data: doTurno } = await c.from("atividades").select("id").eq("turno_id", turnoId).order("ordem");
  const { error: erroConf } = await c.from("atividades").update({ equipe_confirmada: true }).in("id", (doTurno ?? []).slice(1).map((a) => a.id as string));
  if (erroConf) throw new Error(erroConf.message);
  await pl.reload();
  await fotografar(pl, "check-in", "efetivo");
  await fotografar(pl, "check-in", "liberar");
  await pl.getByRole("button", { name: "Liberar para campo" }).click();
  await expect(pl.getByRole("button", { name: "Copiar link" })).toBeVisible();
  await fotografar(pl, "check-in", "enviar-link");
  const { data: t } = await c.from("turnos").select("token_campo").eq("id", turnoId).single();
  const token = t!.token_campo as string;

  // ---------- Campo (celular) ----------
  await request.get(`/t/${token}`);
  const cel = await celular(browser);
  const cartao = (texto: string) => cel.locator("section[aria-labelledby='titulo-atividades'] > div").filter({ hasText: texto });
  await cel.goto(`/t/${token}`);
  await fotografar(cel, "campo", "escolher-nome");

  await cel.goto(`/t/${token}?r=${ids["Ana Souza"]}`);
  await fotografar(cel, "campo", "iniciar");
  await cel.getByRole("region", { name: "Início do turno" }).getByRole("button", { name: "▶ Iniciar turno" }).click();
  await expect(cel.getByRole("region", { name: "Início do turno" }).getByText(/✓ Você iniciou às/)).toBeVisible({ timeout: 20_000 });
  await cartao(ATIVIDADE_NA_TELA.descricao).getByLabel(/Total feito hoje/).fill("12");
  await expect(cartao(ATIVIDADE_NA_TELA.descricao).getByText("Salvo ✓")).toBeVisible({ timeout: 20_000 });
  await fotografar(cel, "campo", "lancar");
  await cartao("Base do compressor").getByRole("button", { name: /Marcar como concluída/ }).click();
  await expect(cartao("Base do compressor").getByText("Salvo ✓")).toBeVisible({ timeout: 20_000 });
  // Conte como foi o dia (IA falsa do playwright.config): prévia com perguntas; depois some com o relato de exemplo.
  const contar = cel.locator("section[aria-labelledby='titulo-contar-dia']");
  await contar.getByRole("textbox").fill("fizemos 20 m de tubulação, faltou andaime");
  await contar.getByRole("button", { name: "Organizar" }).click();
  await expect(contar.getByText("Andaime é…")).toBeVisible({ timeout: 20_000 });
  await fotografar(cel, "campo", "contar-dia");
  await contar.getByRole("button", { name: "Corrigir texto" }).click();
  await contar.getByRole("textbox").fill("");
  await criarClienteAdmin().from("relatos_campo").delete().eq("responsavel_id", ids["Ana Souza"]);

  await cel.goto(`/t/${token}?r=${ids["João Lima"]}`);
  await cartao("Pintura do guarda-corpo").getByLabel(/Total feito hoje/).fill("10");
  await expect(cartao("Pintura do guarda-corpo").getByText("Salvo ✓")).toBeVisible({ timeout: 20_000 });
  const paradas = cel.getByRole("region", { name: "Paradas", exact: true });
  await paradas.getByRole("button", { name: "⚠ Avisar parada" }).click();
  await paradas.getByLabel("Quantos parados").fill("2");
  await paradas.getByLabel("Por quê?").selectOption("material");
  await paradas.getByLabel("Desde").fill("09:30");
  await fotografar(cel, "campo", "parada");
  await cel.getByRole("button", { name: "Registrar parada" }).click();
  await expect(cel.getByRole("button", { name: "Voltamos a trabalhar" })).toBeVisible({ timeout: 20_000 });

  // ---------- Durante o turno (planejador) ----------
  await pl.goto(turnoUrl);
  await fotografar(pl, "durante-o-turno", "paradas");
  await fotografar(pl, "durante-o-turno", "o-que-falta");
  await pl.getByText("Corrigir execução", { exact: true }).click();
  await fotografar(pl, "durante-o-turno", "servico-extra");
  await pl.goto(`${obraUrl}/quadro?turno=${turnoId}`);
  await fotografar(pl, "durante-o-turno", "quadro");

  await paradas.getByRole("button", { name: "Voltamos a trabalhar" }).click();
  await paradas.getByLabel("Voltaram às").fill("11:00");
  await paradas.getByRole("button", { name: "Confirmar" }).click();
  await expect(cel.getByRole("button", { name: "Voltamos a trabalhar" })).toHaveCount(0, { timeout: 20_000 });

  await cel.goto(`/t/${token}?r=${ids["Carlos Pereira"]}`);
  await fotografar(cel, "campo", "extra");
  await cel.getByRole("button", { name: "+ Serviço extra (fora da programação)" }).click();
  await cel.getByLabel("Descrição").fill("Troca de iluminação da plataforma");
  await cel.getByLabel("Quantidade feita").fill("12");
  await cel.getByLabel("Unidade").fill("un");
  await cel.getByRole("button", { name: "Lançar serviço extra" }).click();
  await expect(cel.getByText("Serviço extra lançado.")).toBeVisible({ timeout: 20_000 });
  for (const desc of ["Lançamento de cabos", "Suportes da bandeja"]) {
    await cartao(desc).getByRole("button", { name: /Marcar como concluída/ }).click();
    await expect(cartao(desc).getByText("Salvo ✓")).toBeVisible({ timeout: 20_000 });
  }
  await fotografar(cel, "campo", "avisar");
  await cel.getByRole("button", { name: "✓ Terminei minha parte" }).click();

  // ---------- Fechar o turno ----------
  await pl.goto(turnoUrl);
  await pl.getByText("Corrigir execução", { exact: true }).click();
  await fotografar(pl, "fechar-turno", "check-out");
  // Causa fica atrás do link no cartão: abrir todos antes de escolher.
  const abrir = pl.getByRole("button", { name: "Não vai dar para concluir? Informar causa" });
  while ((await abrir.count()) > 0) await abrir.first().click();
  const causas = pl.getByLabel("Causa do não cumprimento");
  await causas.first().selectOption({ label: "Falta material" });
  await fotografar(pl, "fechar-turno", "causas");
  const n = await causas.count();
  for (let i = 1; i < n; i++) await causas.nth(i).selectOption({ label: "Falta de gente" });
  await expect(pl.getByText("Salvando…")).toHaveCount(0, { timeout: 20_000 });
  await fotografar(pl, "fechar-turno", "fechar");
  await pl.getByRole("button", { name: "Fechar turno" }).click();
  await pl.getByRole("button", { name: "Confirmar fechamento" }).click();
  await expect(pl.getByRole("link", { name: "Baixar RDO (v1)" })).toBeVisible({ timeout: 120_000 });
  await fotografar(pl, "fechar-turno", "rdo");

  // ---------- Encerrar a semana e Análise ----------
  await pl.goto(`${obraUrl}/programacao/${inicio}`);
  await fotografar(pl, "programar-semana", "acompanhar");
  await fotografar(pl, "encerrar-semana", "encerrar");
  await pl.goto(`${obraUrl}/analise`);
  await fotografar(pl, "encerrar-semana", "analise");
  await fotografar(pl, "encerrar-semana", "ppc-dia-a-dia");

  // ---------- Ciência do cliente nos extras (4.3) ----------
  await pl.goto(obraUrl);
  const cartaoCiencia = pl.locator("#ciencia-extras");
  await cartaoCiencia.getByRole("button", { name: "Gerar link" }).first().click();
  await expect(cartaoCiencia.getByRole("link", { name: "Enviar no WhatsApp" }).first()).toBeVisible({ timeout: 20_000 });
  await fotografar(pl, "encerrar-semana", "ciencia-extras");
  const urlFiscal = (await cartaoCiencia.locator("p.break-all").first().textContent())!.trim();
  const fiscal = await browser.newPage({ viewport: { width: 1280, height: 800 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  await fiscal.goto(new URL(urlFiscal).pathname);
  await fiscal.getByLabel("Seu nome e função").fill("Marcos Lima, fiscal");
  await fotografar(fiscal, "encerrar-semana", "ciencia-fiscal");
  await fiscal.close();

  // ---------- Problemas e oportunidades (planejador) ----------
  await pl.goto(`${obraUrl}/turnos/${turnoId}`);
  await pl.getByText(/^Problemas e oportunidades \(/).click();
  await pl.getByRole("button", { name: "+ Problema ou oportunidade" }).click();
  await pl.getByLabel("Descrição").fill("Andaime da área 3 sem liberação");
  await pl.getByLabel("Ação (opcional)").fill("Pedir a liberação ao fiscal do cliente");
  await pl.getByLabel("Responsável (opcional)").fill("Carlos Pereira");
  await pl.getByLabel("Prazo (opcional)").fill(hoje);
  await pl.getByRole("button", { name: "Salvar" }).click();
  await expect(pl.getByTestId("gerenciar-problemas").getByText("Andaime da área 3 sem liberação")).toBeVisible({ timeout: 20_000 });

  // ---------- Quadro na TV (público) ----------
  const { data: o } = await c.from("obras").select("quadro_token").eq("id", obraId).single();
  const tv = await browser.newPage({ viewport: { width: 1280, height: 800 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  await tv.goto(`/q/${o!.quadro_token as string}?turno=${turnoId}`);
  await fotografar(tv, "quadro-tv", "link");
  await fotografar(tv, "quadro-tv", "resumo-turno");
  await fotografar(tv, "quadro-tv", "problemas");

  // ---------- A Ajuda em si ----------
  await pl.goto("/ajuda/nao-existe");
  await expect(pl.getByText(/404|não encontrad/i).first()).toBeVisible();
  const ajudaCel = await celular(browser);
  await entrar(ajudaCel, u);
  await ajudaCel.goto("/ajuda");
  await expect(ajudaCel.getByRole("heading", { name: "Como o Frentia funciona" })).toBeVisible();
  const larguras = await ajudaCel.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(larguras[0], "Ajuda no celular rola para o lado").toBeLessThanOrEqual(larguras[1]);

  expect(naoFotografados(), "Passos com captura que o roteiro não fotografou").toEqual([]);
});
