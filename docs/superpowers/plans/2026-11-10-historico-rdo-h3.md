# Histórico de RDO H3 — RDOs do mês em PDF único — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Botão nas listas de RDOs que baixa, num único PDF com capa e índice, a versão atual de todos os RDOs do mês filtrado.

**Architecture:** Seleção pura em `lib/dominio/lote-rdo.ts`; cada RDO é renderizado pelo mesmo `renderizarRdo` do download individual, a capa é um documento react-pdf próprio, e `pdf-lib` junta tudo. Rota GET `/api/rdo/lote` protegida por sessão + RLS; botão é um link simples (sem JS).

**Tech Stack:** Next.js (App Router, ver `node_modules/next/dist/docs/` antes de mexer em rotas), Supabase, `@react-pdf/renderer`, `pdf-lib` (nova), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-10-historico-rdo-h3-design.md`

## Global Constraints

- `LIMITE_LOTE = 120` RDOs por arquivo.
- Só a versão atual de cada turno; turnos reabertos entram com a última oficial.
- Ordem: obra, depois `compararTurnos` crescente (data, Diurno antes de Noturno).
- Nome: `RDOs-<slug-obra>-AAAA-MM.pdf` / `RDOs-todas-as-obras-AAAA-MM.pdf`.
- Rota: `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 60`, `Cache-Control: no-store`.
- Mensagens: 400 `"Escolha um mês"`; 404 `"Nenhum RDO neste filtro"`; 422 `"Muitos RDOs neste filtro; escolha uma obra"`; 500 `"Não foi possível gerar o arquivo"`.
- Texto vindo do usuário no PDF passa por `sanitizarProfundo`.
- Proibido `localStorage`/`sessionStorage` (AGENTS.md). Sem migration.

## Review Focus

1. Obra renomeada no meio do mês: versões com `obraNome` diferentes da mesma obra devem ficar juntas (agrupar por `obraId`, rotular pelo nome do RDO mais recente da obra) — teste em Task 1.
2. Índice com muitas linhas (ex.: 120) ocupa 2+ páginas: as páginas do índice devem bater com o arquivo final — teste em Task 3.
3. Nome de obra com emoji/acentos: capa não quebra (sanitização) e o nome do arquivo sai ASCII — testes em Tasks 1 e 3.
4. Sessão expirada ao clicar: login devolve para `/api/rdo/lote?mes=…&obra=…` com a query preservada — teste em Task 4.
5. `?obra=` de outra empresa ou inexistente: 404, nunca vazamento — teste em Task 4.

---

### Task 1: Seleção do lote e nome do arquivo

**Files:**
- Create: `lib/dominio/lote-rdo.ts`
- Modify: `lib/rdo/nome-arquivo.ts`
- Test: `tests/dominio/lote-rdo.test.ts`

**Interfaces:**
- Consumes: `ItemVersao`, `agruparVersoes` (`lib/dominio/historico-rdo.ts`); `compararTurnos` (`lib/dominio/regras.ts`).
- Produces:
  - `export const LIMITE_LOTE = 120`
  - `export type ItemLote = { atual: ItemVersao; reaberto: boolean; anterior?: { numero: number; emitido_em: string } }`
  - `export function selecionarLote(itens: ItemVersao[], mes: string, obraId: string | null): ItemLote[]`
  - `export function paginasIniciais(paginasCapa: number, paginasPorRdo: number[]): number[]`
  - `export function nomeArquivoLote(obraNome: string | null, mes: string): string` (em `nome-arquivo.ts`)

- [ ] **Step 1: Testes que falham** (`item(over)` igual ao de `tests/dominio/historico-rdo.test.ts`)
  - `"só a versão atual, com a anterior"`: turno A v1+v2, B v1 → 2 itens; o de A tem `atual.id === "a2"` e `anterior` `{ numero: 1, emitido_em: a1.emitidoEm }`; o de B sem `anterior`.
  - `"filtra mês e obra"`: item de `2026-10-31` fica fora com `mes="2026-11"`; `obraId="o2"` deixa só os de `o2`.
  - `"ordem obra → data → período"`: obras "Beta"(o2) e "Alfa"(o1); Alfa 09/11 noturno, Alfa 09/11 diurno, Alfa 02/11 diurno, Beta 01/11 → ids na ordem Alfa 02 diurno, Alfa 09 diurno, Alfa 09 noturno, Beta 01.
  - `"obra renomeada fica junta"`: o1 com turno 02/11 `obraNome:"Zeta"` (emitido antes) e turno 09/11 `obraNome:"Alfa"` (emitido depois), o2 "Beta" → ordem o1, o1, o2 (grupo rotulado "Alfa").
  - `"reaberto"`: `turnoStatus:"enviado"` → `reaberto: true`.
  - `paginasIniciais(1, [2, 1, 3])` → `[2, 4, 5]`; `paginasIniciais(2, [1])` → `[3]`; `paginasIniciais(1, [])` → `[]`.
  - `nomeArquivoLote("Edifício Aurora 🏗", "2026-11")` → `"RDOs-edificio-aurora-2026-11.pdf"`; `nomeArquivoLote(null, "2026-11")` → `"RDOs-todas-as-obras-2026-11.pdf"`.

- [ ] **Step 2:** `npx vitest run tests/dominio/lote-rdo.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar.** Ordenação: rótulo de cada `obraId` = `obraNome` do item com maior `emitidoEm` daquela obra no lote; ordenar por rótulo (`localeCompare(…, "pt-BR")`), desempate `obraId`, depois `compararTurnos(a.atual, b.atual)`. `anterior` = `grupo.anteriores.find(v => v.numero === atual.numero - 1)` mapeado para `{ numero, emitido_em: emitidoEm }` (formato que `emissaoDaVersao` espera). `nomeArquivoLote` reaproveita `slug`.

- [ ] **Step 4:** mesmo comando → PASS.

- [ ] **Step 5: Commit** `feat(lote): seleção dos RDOs do mês e nome do arquivo`

---

### Task 2: `renderizarRdo` compartilhado, `obterVersoes` e `pdf-lib`

**Files:**
- Modify: `lib/rdo/responder.ts`, `lib/db/rdo-versoes.ts`, `package.json` (`npm i pdf-lib`)
- Test: `tests/dominio/rdo-responder.test.ts`, `tests/integracao/rdo-versoes-leitura.test.ts`

**Interfaces:**
- Produces:
  - `export async function renderizarRdo(turno: TurnoCompleto, emissao: Emissao): Promise<Buffer>` (em `responder.ts`; `respostaPdf` passa a chamá-la)
  - `export async function obterVersoes(c: SupabaseClient, ids: string[]): Promise<VersaoRdo[]>` — `[]` para `ids` vazio; ids não-UUID filtrados antes da consulta; mesmo `select` de `obterVersao`; erro → log + throw.

- [ ] **Step 1: Testes que falham**
  - `rdo-responder.test.ts` → `"renderizarRdo devolve o PDF"`: buffer começa com `%PDF`; `PDFDocument.load(buf)` tem `getPageCount() >= 1`.
  - `rdo-versoes-leitura.test.ts` → `"obterVersoes traz as fotos pedidas"`: com os 2 ids de `versoesDoTurno`, devolve 2 linhas com `formato: 1` e `dados` objeto; `obterVersoes(outro.cliente, ids)` → `[]`; `obterVersoes(u.cliente, [])` → `[]`.
- [ ] **Step 2:** `npx vitest run tests/dominio/rdo-responder.test.ts` → FAIL; `SUPABASE_TEST=1 npx vitest run tests/integracao/rdo-versoes-leitura.test.ts` → FAIL.
- [ ] **Step 3: Implementar** (instalar `pdf-lib` primeiro).
- [ ] **Step 4:** os dois comandos → PASS.
- [ ] **Step 5: Commit** `refactor(rdo): renderizarRdo compartilhado; obterVersoes em lote`

---

### Task 3: Capa e montagem do arquivo

**Files:**
- Create: `lib/rdo/capa-lote.tsx`, `lib/rdo/lote.ts`
- Modify: `lib/rdo/documento.tsx` (exportar `logoFrentia`)
- Test: `tests/dominio/rdo-lote.test.tsx`

**Interfaces:**
- Consumes: `ItemLote`, `paginasIniciais` (Task 1); `renderizarRdo`, `VersaoRdo` (Task 2); `lerFoto`, `emissaoDaVersao` (`lib/rdo/versao.ts`); `rotuloMes`.
- Produces:
  - `export type CabecalhoLote = { mes: string; obraNome: string | null; geradoEm: Date }`
  - `export function CapaLote(props: { cabecalho: CabecalhoLote; lote: ItemLote[]; paginas: number[] })` — documento react-pdf.
  - `export async function renderizarCapa(cabecalho: CabecalhoLote, lote: ItemLote[], paginasPorRdo: number[]): Promise<{ buffer: Buffer; paginas: number[] }>` — faz a re-renderização quando a capa passa de 1 página; `paginas` = as que foram impressas no índice.
  - `export async function montarLote(lote: ItemLote[], versoes: VersaoRdo[], cabecalho: CabecalhoLote): Promise<Uint8Array>` — puro (sem banco); versão faltando para algum `lote[i].atual.id` → throw.

Textos da capa (exatos): título `RDOs de ${rotuloMes(mes)}`; `obraNome ?? "Todas as obras"`; `"1 RDO"` / `"N RDOs"`; `Gerado em ${dataHoraBrasilia(geradoEm)} (horário de Brasília)`; com reabertos: `"1 turno reaberto: incluída a última versão oficial."` / `"N turnos reabertos: incluída a última versão oficial."`; colunas `Data · Período · Versão · % cumprido · Página` (+ `Obra` primeiro quando `obraNome === null`); rodapé `Página X de Y`.

- [ ] **Step 1: Testes que falham** (fotos montadas no formato `FotoV1`, ver `tests/dominio/rdo-versao.test.ts`)
  - `"páginas = capa + soma dos RDOs"`: 2 itens → `PDFDocument.load(montarLote(...))`: `getPageCount()` igual a `páginas da capa + Σ getPageCount(renderizarRdo(...))` de cada um; título do PDF `"RDOs — Obra — novembro de 2026"`.
  - `"índice longo: páginas batem"`: `renderizarCapa(cabecalho, lote60, Array(60).fill(1))` → `PDFDocument.load(buffer).getPageCount()` = P ≥ 2 e `paginas[0] === P + 1`, `paginas[59] === P + 60`.
  - `"versão faltando falha"`: `versoes` sem um id → rejeita.
  - `"emoji no nome da obra não quebra"`: `obraNome: "Obra 🏗"` → resolve com `%PDF`.
- [ ] **Step 2:** `npx vitest run tests/dominio/rdo-lote.test.tsx` → FAIL.
- [ ] **Step 3: Implementar.** RDOs renderizados em sequência; capa renderizada com `paginasIniciais(1, …)`; se `getPageCount()` da capa = P > 1, renderizar de novo com `paginasIniciais(P, …)`; juntar com `PDFDocument.create()` + `copyPages`; `setTitle`, `setAuthor("Frentia")`, `setCreator("Frentia")`.
- [ ] **Step 4:** mesmo comando → PASS. Anotar o tempo do teste de 60 itens.
- [ ] **Step 5: Commit** `feat(lote): capa com índice e PDF único`

---

### Task 4: Rota `/api/rdo/lote`

**Files:**
- Create: `app/api/rdo/lote/route.ts`
- Test: `tests/integracao/rdo-lote.test.ts`

**Interfaces:**
- Consumes: `normalizarMes`, `listarVersoes`, `selecionarLote`, `LIMITE_LOTE`, `obterVersoes`, `montarLote`, `nomeArquivoLote`, `caminhoSeguro`, `criarClienteServidor`.
- Produces: `GET(req: Request): Promise<Response>`. Extrair a lógica após a sessão para `export async function respostaLote(c: SupabaseClient, mes: string | null, obra: string | null): Promise<Response>` em `lib/rdo/lote.ts`, testável com o cliente de teste.

Fluxo: sem usuário → `redirect(\`/login?proximo=${encodeURIComponent(caminhoSeguro(pathname + search))}\`)` fora de try/catch; resto conforme spec §2 "Rota". `obraNome` do cabeçalho = rótulo do 1º item quando `obra` dado, senão `null`.

- [ ] **Step 1: Testes que falham** (obra própria com turno fechado `2026-11-05` + turno reaberto e fechado de novo `2026-11-06` → v2; usuário `outro`)
  - `"gera o PDF do mês"`: `respostaLote(u.cliente, "2026-11", obraId)` → 200, `Content-Disposition` `attachment; filename="RDOs-obra-lote-2026-11.pdf"`, `no-store`; PDF com páginas = capa + 2 RDOs (≥ 3).
  - `"sem mês"` → 400 `{ erro: "Escolha um mês" }`; `obra="abc"` → 400.
  - `"mês vazio"` (`"2026-01"`) → 404 `{ erro: "Nenhum RDO neste filtro" }`.
  - `"outra empresa"`: `respostaLote(outro.cliente, "2026-11", obraId)` → 404.
  - Unidade em `tests/dominio/caminho.test.ts`: `caminhoSeguro("/api/rdo/lote?mes=2026-11&obra=x")` devolve a mesma string.
  - Teto: unidade em `tests/dominio/lote-rdo.test.ts` não cobre a resposta; testar 422 com `respostaLote` exigiria 121 turnos — em vez disso extrair `validarLote(lote: ItemLote[]): { status: 404 | 422; erro: string } | null` em `lib/rdo/lote.ts` e testar 0 / 120 / 121 na unidade.
- [ ] **Step 2:** `SUPABASE_TEST=1 npx vitest run tests/integracao/rdo-lote.test.ts` → FAIL.
- [ ] **Step 3: Implementar** (ler a doc de route handlers em `node_modules/next/dist/docs/` sobre `maxDuration`).
- [ ] **Step 4:** mesmo comando + `npx vitest run tests/dominio` → PASS.
- [ ] **Step 5: Commit** `feat(lote): rota /api/rdo/lote`

---

### Task 5: Botão nas listas + E2E

**Files:**
- Create: `components/rdo/BaixarLote.tsx`
- Modify: `app/(app)/rdos/page.tsx`, `app/(app)/obras/[obraId]/rdos/page.tsx`, `tests/e2e/ciclo-turno.spec.ts`
- Test: `tests/dominio/lista-rdos.test.tsx`

**Interfaces:**
- Produces: `export function BaixarLote(props: { mes: string | null; quantidade: number; obraId?: string | null })` — monta `href` `/api/rdo/lote?mes=…` + `&obra=…` quando houver.

- [ ] **Step 1: Testes que falham** (`renderToStaticMarkup`)
  - sem mês ou `quantidade: 0` → `""`.
  - `quantidade: 1` → link `href="/api/rdo/lote?mes=2026-11"` com texto `Baixar o RDO (PDF único)`.
  - `quantidade: 23, obraId: "o1"` → `href="/api/rdo/lote?mes=2026-11&amp;obra=o1"`, texto `Baixar os 23 RDOs (PDF único)`.
  - `quantidade: 121` → sem link; texto `Muitos RDOs neste filtro (121). Escolha uma obra para baixar em PDF único.`
- [ ] **Step 2:** `npx vitest run tests/dominio/lista-rdos.test.tsx` → FAIL.
- [ ] **Step 3: Implementar** e usar nas duas páginas entre `FiltrosRdo` e `ListaRdos`, com `quantidade = grupos.length` (calcular `agruparVersoes` uma vez). Em `/obras/[obraId]/rdos` passar `obraId={obra.id}`; em `/rdos` passar o `obra` do filtro.
- [ ] **Step 4:** mesmo comando → PASS.
- [ ] **Step 5: E2E** — no fim do teste existente, após `page.goto(\`${obraUrl}/rdos\`)`: pré-aquecer `page.request.get("/api/rdo/lote?mes=" + mesDoTurno + "&obra=" + obraId)`, selecionar o mês, Filtrar, clicar `Baixar o RDO (PDF único)`, conferir `download.suggestedFilename()` = `RDOs-obra-e2e-${mesDoTurno}.pdf` e conteúdo começando com `%PDF`. Rodar `SUPABASE_TEST=1 npx playwright test` → PASS.
- [ ] **Step 6: Commit** `feat(lote): botão "Baixar os N RDOs (PDF único)" nas listas`

---

### Task 6: Verificação e entrega

- [ ] `npx vitest run`, `SUPABASE_TEST=1 npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build` → tudo verde.
- [ ] Revisão final da branch por subagente (modelo mais capaz).
- [ ] `git push -u origin historico-rdo-h3` → prévia Vercel; usuário valida baixando um mês real.
- [ ] Após ok: `git checkout main && git merge --no-ff historico-rdo-h3 && git push` (produção); atualizar memória do roadmap.
