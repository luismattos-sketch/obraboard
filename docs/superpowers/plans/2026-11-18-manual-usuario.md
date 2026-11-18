# Manual do usuário dentro do app — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aba "Ajuda" com tutorial completo do planejador (fluxograma, Novidades, busca, capítulos com capturas reais), "Como usar" no link de campo e botão "?" nas telas principais.

**Architecture:** Conteúdo tipado em `lib/ajuda/` (capítulos → passos, fluxograma e novidades como dados), funções puras testadas (busca, destino do "?", navegação entre capítulos), páginas `/ajuda` e `/ajuda/[capitulo]` no grupo `(app)`, e um roteiro Playwright separado que monta uma obra de exemplo, fotografa cada passo destacando o `alvo` registrado no conteúdo e falha se o alvo sumiu.

**Tech Stack:** Next.js 16.2.6 (App Router, `params` como Promise), React 19, Tailwind (tokens em `app/globals.css`), Vitest + `renderToStaticMarkup`, Playwright.

**Spec:** [docs/superpowers/specs/2026-11-18-manual-usuario-design.md](../specs/2026-11-18-manual-usuario-design.md)

## Global Constraints

- Ler `node_modules/next/dist/docs/` antes de escrever rotas/páginas (Next 16 tem mudanças de API).
- Nunca `localStorage`/`sessionStorage`. Nada de estado guardado no navegador (painéis abrem com `<details>`).
- Nenhuma dependência nova (sem MDX/Markdown/diagrama).
- Termo "Responsável", nunca "encarregado", em todo texto do manual.
- Rótulos de botões citados no texto entre aspas, exatamente como na tela.
- Cores só pelos tokens (`primaria`, `destaque`, `primaria-clara`, `borda`, `texto-suave`…).
- Fluxograma: planejador = `bg-primaria text-white`; campo = `bg-destaque text-white`; TV = `bg-primaria-clara text-primaria border border-dashed border-primaria`.
- Capturas: computador 1280×800; celular = `devices["Pixel 7"]`; arquivos `public/ajuda/<capitulo>-<passo>.png`.
- Funciona no celular sem rolagem horizontal; `alt` em toda captura.
- Ao concluir: deploy no Vercel (regra do AGENTS.md).

## Review Focus

- Busca com acento, hífen e maiúsculas ("check in" acha "Check-in", "programacao" acha "Programação") → teste na Task 2.
- `/ajuda/slug-inexistente` → página 404, não erro → `capituloPorSlug` retorna `undefined` (Task 1) e a página chama `notFound()` (Task 4).
- Capítulo `campo` fora do índice e pulado por "Próximo capítulo", mas acessível por URL → testes da Task 1.
- Menu recolhido: item "Ajuda" mantém `title` e `aria-current` em `/ajuda/...` → teste da Task 4.
- `/ajuda` no celular sem rolagem horizontal (fluxograma quebra linha) → verificação no roteiro da Task 6.

---

### Task 1: Modelo do conteúdo e navegação entre capítulos

**Files:**
- Create: `lib/ajuda/tipos.ts`, `lib/ajuda/capitulos.ts` (lista + funções), `lib/ajuda/conteudo/*.ts` (um arquivo por capítulo), `lib/ajuda/fluxograma.ts`, `lib/ajuda/novidades.ts`
- Test: `tests/dominio/ajuda-conteudo.test.ts`

**Interfaces:**
- Produces (`lib/ajuda/tipos.ts`):
  ```ts
  export type SlugCapitulo = "primeiros-passos" | "programar-semana" | "check-in" | "durante-o-turno"
    | "fechar-turno" | "encerrar-semana" | "quadro-tv" | "duvidas" | "campo";
  export type Ator = "planejador" | "campo" | "tv";
  export type Alvo = { papel: "button" | "link" | "heading" | "textbox" | "combobox" | "checkbox"; nome: string };
  export type Captura = { alt: string; alvo: Alvo; dispositivo: "computador" | "celular" };
  export type Passo = { id: string; titulo: string; texto: string[]; dica?: string; captura?: Captura };
  export type Capitulo = { slug: SlugCapitulo; titulo: string; resumo: string; noIndice: boolean; passos: Passo[] };
  export type CaixaFluxo = { rotulo: string; detalhe?: string; ator: Ator; href: string };
  export type FaseFluxo = { titulo: string; linhas: CaixaFluxo[][]; nota?: string };
  export type Novidade = { data: string /* YYYY-MM-DD */; texto: string; href: string };
  ```
- Produces (`lib/ajuda/capitulos.ts`): `CAPITULOS: Capitulo[]` (ordem da tabela do spec §3, `campo` por último com `noIndice: true`); `capituloPorSlug(slug: string): Capitulo | undefined`; `capitulosDoIndice(): Capitulo[]`; `proximoCapitulo(slug: SlugCapitulo): Capitulo | null` (pula `noIndice`; `duvidas` e `campo` → `null`); `hrefPasso(slug: SlugCapitulo, passoId?: string): string` (`/ajuda/check-in#liberar`); `caminhoCaptura(slug: SlugCapitulo, passoId: string): string` (`/ajuda/check-in-liberar.png`).
- Produces: `FLUXOGRAMA: FaseFluxo[]` (`lib/ajuda/fluxograma.ts`), `NOVIDADES: Novidade[]` mais recente primeiro (`lib/ajuda/novidades.ts`).

- [ ] **Step 1: Escrever os testes** em `tests/dominio/ajuda-conteudo.test.ts`:
  - `capituloPorSlug("check-in")?.titulo === "Abrir o turno e fazer o check-in"`; `capituloPorSlug("xyz") === undefined`.
  - `capitulosDoIndice().map(c => c.slug)` igual às 8 slugs do spec §3, em ordem, sem `campo`.
  - `proximoCapitulo("primeiros-passos")?.slug === "programar-semana"`; `proximoCapitulo("duvidas") === null`; `proximoCapitulo("campo") === null`.
  - `hrefPasso("check-in", "liberar") === "/ajuda/check-in#liberar"`; `hrefPasso("check-in") === "/ajuda/check-in"`; `caminhoCaptura("check-in", "liberar") === "/ajuda/check-in-liberar.png"`.
  - Integridade: ids de passo únicos dentro de cada capítulo; todo capítulo tem ≥ 1 passo; todo `href` de `FLUXOGRAMA` e `NOVIDADES` aponta para capítulo existente e, se tiver `#`, para passo existente (helper local `hrefValido`).
  - `FLUXOGRAMA` tem 4 fases, com títulos "Uma vez por obra", "Toda semana", "Todo turno", "Fim da semana".
  - Nenhum texto (títulos, `texto`, `dica`, `alt`, rótulos do fluxograma, novidades) contém `/encarregad/i`.
  - Toda `captura` do capítulo `campo` tem `dispositivo: "celular"`; nos demais, `"computador"`.
- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run tests/dominio/ajuda-conteudo.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3: Implementar tipos, funções e o esqueleto do conteúdo** — capítulos com título, resumo e ao menos um passo cada (texto completo vem na Task 3); `FLUXOGRAMA` com as caixas exatas do spec §2 (inclui a nota da fase 3) e `href` de cada caixa; `NOVIDADES` com a entrada "Manual do usuário dentro do app" (2026-11-18 → `/ajuda`) e uma por item 1–7 do backlog (`docs/backlog.md`, datas 2026-11-16/17), cada uma ligada ao capítulo que cobre o assunto.
- [ ] **Step 4: Rodar e ver passar** — mesmo comando → PASS.
- [ ] **Step 5: Commit** — `feat(ajuda): modelo do conteúdo do manual`.

### Task 2: Busca e destino do botão "?"

**Files:**
- Create: `lib/ajuda/busca.ts`, `lib/ajuda/destino.ts`
- Test: `tests/dominio/ajuda-busca.test.ts`

**Interfaces:**
- Consumes: `Capitulo`, `CAPITULOS`, `hrefPasso` (Task 1).
- Produces:
  ```ts
  export type ResultadoBusca = { slug: SlugCapitulo; capitulo: string; passoId: string; passo: string; href: string };
  export function normalizarBusca(s: string): string; // sem acento, minúsculas, hífen/pontuação → espaço, espaços colapsados
  export function buscarAjuda(termo: string, capitulos?: Capitulo[]): ResultadoBusca[];
  export type TelaAjuda = "obras" | "programacao" | "encerrar-semana" | "turno-planejado" | "turno-em-campo"
    | "turno-fechamento" | "rdos" | "analise" | "quadro";
  export function destinoAjuda(tela: TelaAjuda): string;
  export function telaDoTurno(status: "planejado" | "em_campo" | "enviado" | "fechado"): TelaAjuda;
  ```

- [ ] **Step 1: Escrever os testes:**
  - `normalizarBusca("Check-in  Programação") === "check in programacao"`.
  - `buscarAjuda("")` e `buscarAjuda("a")` → `[]` (mínimo 2 caracteres após normalizar).
  - `buscarAjuda("check in")` contém resultado com `slug: "check-in"`; `buscarAjuda("programacao")` contém `slug: "programar-semana"`.
  - Todas as palavras precisam aparecer (título + texto + dica do passo): termo com uma palavra inexistente → `[]`.
  - Passos cujo título casa vêm antes dos que só casam no texto (capítulos de teste montados no próprio arquivo).
  - `href` do resultado = `hrefPasso(slug, passoId)`.
  - `destinoAjuda` segue a tabela do spec §5: `obras`→`/ajuda/primeiros-passos`, `programacao`→`/ajuda/programar-semana`, `encerrar-semana` e `analise`→`/ajuda/encerrar-semana`, `turno-planejado`→`/ajuda/check-in`, `turno-em-campo`→`/ajuda/durante-o-turno`, `turno-fechamento` e `rdos`→`/ajuda/fechar-turno`, `quadro`→`/ajuda/quadro-tv`.
  - `telaDoTurno`: `planejado`→`turno-planejado`, `em_campo`→`turno-em-campo`, `enviado`/`fechado`→`turno-fechamento`.
- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run tests/dominio/ajuda-busca.test.ts` → FAIL.
- [ ] **Step 3: Implementar** (`normalize("NFD")` + remoção de diacríticos).
- [ ] **Step 4: Rodar e ver passar** → PASS.
- [ ] **Step 5: Commit** — `feat(ajuda): busca e destino do botão de ajuda`.

### Task 3: Texto completo dos capítulos

**Files:**
- Modify: `lib/ajuda/conteudo/*.ts`
- Test: `tests/dominio/ajuda-conteudo.test.ts` (já cobre integridade)

**Interfaces:** Consumes os tipos da Task 1. Não muda assinaturas.

- [ ] **Step 1: Conferir o comportamento atual** de cada capítulo na tela e nos specs de `docs/superpowers/specs/` (programação semanal, quadro/check-in, efetivo/HH, links, sinal fraco, conflito de abas, aviso de parada, serviço extra). Anotar os rótulos exatos dos botões (grep nos componentes).
- [ ] **Step 2: Escrever os passos** de cada capítulo cobrindo exatamente o que a coluna "Cobre" do spec §3 lista; capítulo `campo` com 5–7 passos do spec §4. Todo passo que mostra uma tela tem `captura` com `alvo` = papel + nome acessível do elemento principal do passo (o mesmo que `getByRole` acharia) e `alt` descrevendo a tela. Linguagem simples, imperativo, parágrafos curtos.
- [ ] **Step 3: Rodar** `npx vitest run tests/dominio/ajuda-conteudo.test.ts tests/dominio/ajuda-busca.test.ts` → PASS.
- [ ] **Step 4: Commit** — `docs(ajuda): texto do manual do planejador e do campo`.

### Task 4: Páginas da Ajuda, fluxograma e item no menu

**Files:**
- Create: `app/(app)/ajuda/page.tsx`, `app/(app)/ajuda/[capitulo]/page.tsx`, `components/ajuda/Fluxograma.tsx`, `components/ajuda/Novidades.tsx`, `components/ajuda/BuscaAjuda.tsx` (cliente), `components/ajuda/PassoAjuda.tsx`
- Modify: `components/navegacao/MenuLateral.tsx`, `lib/dominio/navegacao.ts`
- Test: `tests/dominio/ajuda-ui.test.tsx`, `tests/dominio/navegacao.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: `naAjuda(caminho: string): boolean` em `lib/dominio/navegacao.ts`; `PassoAjuda({ slug, passo, numero })` (reusado na Task 5); `Fluxograma({ fases })`.

- [ ] **Step 1: Escrever os testes:**
  - `navegacao.test.ts`: `naAjuda("/ajuda") === true`, `naAjuda("/ajuda/check-in") === true`, `naAjuda("/ajudante") === false`, `naAjuda("/obras") === false`.
  - `ajuda-ui.test.tsx` (`renderToStaticMarkup`): `Fluxograma` renderiza as 4 fases, cada caixa como `<a href>` igual ao `href` dos dados, a nota da fase 3, e uma lista em texto para leitor de tela (`sr-only`); `PassoAjuda` renderiza `id` do passo, número, título, parágrafos, dica e `<img>`/`Image` com `alt` e `src` = `caminhoCaptura`; `Novidades` mostra as 3 primeiras e as demais dentro de `<details>` "Ver todas".
- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run tests/dominio/ajuda-ui.test.tsx tests/dominio/navegacao.test.ts` → FAIL.
- [ ] **Step 3: Implementar.**
  - `/ajuda`: na ordem do spec §1 — título "Ajuda" + `BuscaAjuda`, `Novidades`, `Fluxograma` "Como o Frentia funciona" (legenda acima), índice em cartões (`Cartao`) com título e resumo de `capitulosDoIndice()`.
  - `BuscaAjuda`: `useState` do termo, resultados de `buscarAjuda`; sem resultado → "Nada encontrado. Veja as Dúvidas comuns." com link `/ajuda/duvidas`.
  - `/ajuda/[capitulo]`: `capituloPorSlug` → `notFound()` se `undefined`; `generateStaticParams` com todas as slugs; passos numerados com `PassoAjuda`; rodapé "Próximo: <título>" (se houver) e "Voltar à Ajuda"; `metadata` com o título do capítulo.
  - Menu: item global "Ajuda" com ícone "?" (mesmo `Icone` do arquivo), ao lado de "RDOs de todas as obras", `aria-current="page"` quando `naAjuda`, `title="Ajuda"` quando recolhido.
- [ ] **Step 4: Rodar** os testes → PASS; `npm run lint` e `npx tsc --noEmit` sem erros.
- [ ] **Step 5: Conferir no navegador** (`npm run dev`): `/ajuda`, um capítulo, `/ajuda/xyz` (404), menu recolhido e aberto, celular (DevTools 412 px) sem rolagem horizontal. Capturas ainda não existem; imagem quebrada aqui é esperada até a Task 6.
- [ ] **Step 6: Commit** — `feat(ajuda): páginas da ajuda, fluxograma e item no menu`.

### Task 5: Botão "?" nas telas e "Como usar" no link de campo

**Files:**
- Create: `components/ajuda/BotaoAjuda.tsx`, `components/ajuda/ComoUsarCampo.tsx`
- Modify: cabeçalhos de `app/(app)/obras/page.tsx`, `obras/nova/page.tsx`, `obras/[obraId]/page.tsx`, `programacao/page.tsx`, `programacao/[inicio]/page.tsx`, `turnos/novo/page.tsx`, `turnos/[turnoId]/page.tsx`, `turnos/[turnoId]/checkin/page.tsx`, `rdos/page.tsx`, `app/(app)/rdos/page.tsx`, `analise/page.tsx`, `quadro/page.tsx`; `app/t/[token]/page.tsx`
- Test: `tests/dominio/ajuda-ui.test.tsx`

**Interfaces:**
- Consumes: `destinoAjuda`, `telaDoTurno` (Task 2); `PassoAjuda` (Task 4); `capituloPorSlug("campo")`.
- Produces: `BotaoAjuda({ tela }: { tela: TelaAjuda })`; `ComoUsarCampo()`.

- [ ] **Step 1: Escrever os testes:** `BotaoAjuda tela="turno-em-campo"` gera `<a href="/ajuda/durante-o-turno" aria-label="Ajuda sobre esta tela">`; `ComoUsarCampo` gera `<details>` com `<summary>` "Como usar" e todos os passos do capítulo `campo`, sem `localStorage`/`sessionStorage` no código-fonte (ler o arquivo e conferir).
- [ ] **Step 2: Rodar e ver falhar** → FAIL.
- [ ] **Step 3: Implementar e posicionar.** "?" no canto do cabeçalho de cada tela, conforme a tabela do spec §5; na semana da programação usar `encerrar-semana` quando a tela mostra "Encerrar semana" (mesma condição que já exibe o botão), senão `programacao`; no turno usar `telaDoTurno(turno.status)`. No campo, `ComoUsarCampo` logo abaixo do cabeçalho, também na tela "Quem é você?"; não aparece com link inválido.
- [ ] **Step 4: Rodar** `npm test`, `npm run lint` e `npx tsc --noEmit` → tudo passa.
- [ ] **Step 5: Commit** — `feat(ajuda): botão de ajuda nas telas e como usar no campo`.

### Task 6: Roteiro de capturas

**Files:**
- Create: `tests/manual/capturas.spec.ts`, `tests/manual/fotografar.ts`, `tests/manual/obraExemplo.ts`, `public/ajuda/*.png`
- Modify: `playwright.config.ts` (projetos), `package.json` (scripts)
- Test: `tests/dominio/ajuda-capturas.test.ts`

**Interfaces:**
- Consumes: `CAPITULOS`, `caminhoCaptura` (Task 1); `prepararUsuario`/`limparUsuario` (`tests/e2e/preparar.ts`).
- Produces: `fotografar(page: Page, slug: SlugCapitulo, passoId: string): Promise<void>` em `tests/manual/fotografar.ts`.

- [ ] **Step 1: Teste de existência** `tests/dominio/ajuda-capturas.test.ts`: para todo passo com `captura`, o arquivo `public` + `caminhoCaptura(slug, id)` existe.
- [ ] **Step 2: Rodar e ver falhar** → FAIL (imagens ainda não existem).
- [ ] **Step 3: Configurar.** `playwright.config.ts`: projeto atual ganha `testDir: "./tests/e2e"`; novo projeto `{ name: "manual", testDir: "./tests/manual", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } }`. Scripts: `"test:e2e": "playwright test --project=\"Desktop Chrome\""`, `"manual:capturas": "playwright test --project=manual"`. Como o e2e, pula sem `SUPABASE_TEST=1`.
- [ ] **Step 4: Implementar `fotografar`:** acha o passo em `CAPITULOS` (erro se não existir ou sem `captura`); `page.getByRole(alvo.papel, { name: alvo.nome }).first()`; `expect(...).toBeVisible()` com mensagem `"Manual desatualizado: <slug>#<passo> não achou <papel> \"<nome>\""`; injeta contorno laranja (`outline: 3px solid #ff6b00; outline-offset: 3px`) no elemento, `page.screenshot({ path: "public" + caminhoCaptura(...) })`, remove o contorno. Registra o passo num conjunto de fotografados. Se `MANUAL_CAPITULO` estiver definida e for diferente de `slug`, valida o alvo mas não grava o arquivo.
- [ ] **Step 5: Implementar o roteiro** `capturas.spec.ts` (um teste, `test.setTimeout` amplo): usuário de teste → login → obra de exemplo de `obraExemplo.ts` ("Ampliação do Galpão 3", cliente fictício, 3 responsáveis com nomes fictícios, ~6 atividades na semana com equipe prevista) → percorre os capítulos na ordem do fluxograma, chamando `fotografar` em cada passo; o capítulo `campo` usa `browser.newContext({ ...devices["Pixel 7"] })` no link de campo, com uma parada e um serviço extra; termina com `/ajuda` no celular checando `document.documentElement.scrollWidth <= clientWidth`. No fim, falha se algum passo com `captura` não foi fotografado (lista os que faltam). `afterAll` → `limparUsuario`.
- [ ] **Step 6: Gerar** — `SUPABASE_TEST=1 npm run manual:capturas` → PASS e `public/ajuda/` preenchido. Abrir 3–4 imagens e conferir que o destaque está no elemento certo e que não há dado real.
- [ ] **Step 7: Rodar** `npx vitest run tests/dominio/ajuda-capturas.test.ts` → PASS; `SUPABASE_TEST=1 npm run test:e2e` continua rodando só o e2e.
- [ ] **Step 8: Commit** — `feat(ajuda): roteiro de capturas e imagens do manual`.

### Task 7: Regra de manutenção, backlog e publicação

**Files:**
- Modify: `AGENTS.md`, `docs/backlog.md`, `docs/superpowers/specs/2026-11-18-manual-usuario-design.md` (trocar `-- --grep <capitulo>` por `MANUAL_CAPITULO=<capitulo>`)

- [ ] **Step 1: AGENTS.md** — acrescentar à seção de regras: "Funcionalidade que muda o que o usuário vê ou faz atualiza no mesmo PR o manual (`lib/ajuda/`), as capturas (`SUPABASE_TEST=1 npm run manual:capturas`, ou `MANUAL_CAPITULO=<capitulo>` para um só) e, se mudar a sequência, o fluxograma (`lib/ajuda/fluxograma.ts`); e ganha uma linha em Novidades (`lib/ajuda/novidades.ts`)."
- [ ] **Step 2: Backlog** — marcar o item 20 como "✅ Feito em <data>" e mover o item 8 para "Próximo".
- [ ] **Step 3: Verificação final** — `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` → todos sem erro.
- [ ] **Step 4: Commit** — `docs: regra de manutenção do manual e backlog`.
- [ ] **Step 5: Publicar** — seguir superpowers:finishing-a-development-branch (PR → merge em `main`) e confirmar o deploy de produção no Vercel; abrir `www.frentia.com.br/ajuda` logado e conferir.
