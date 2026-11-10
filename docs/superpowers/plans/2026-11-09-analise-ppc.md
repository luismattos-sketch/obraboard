# Análise de PPC e causas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tela `/obras/[obraId]/analise` com PPC semanal (com turnos de cada semana) e ranking de causas de não cumprimento, calculados a partir dos turnos fechados da obra.

**Architecture:** Uma consulta nova em `lib/db/turnos.ts` traz os turnos fechados do período (RLS do usuário). Uma função pura em `lib/dominio/analise.ts` agrega semanas e causas reaproveitando `statusAtividade`/`percentualCumprimento`. Uma página Server Component renderiza barras em HTML/CSS e acordeões `<details>`.

**Tech Stack:** Next.js 16.2.6 App Router (Server Components; `params` e `searchParams` são `Promise`), React 19, Tailwind 4, Supabase JS, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-09-analise-ppc-design.md`

## Global Constraints

- Sem migration, sem dependência nova, sem biblioteca de gráficos.
- Nunca usar `localStorage`/`sessionStorage` (AGENTS.md). Período via query `?semanas=N`, N ∈ {4, 8, 12}, padrão 8.
- Só turnos `status = 'fechado'` entram no cálculo.
- PPC = Σ concluídas ÷ Σ atividades (ponderado por atividade), nunca média dos % de turno.
- "Concluída" = `statusAtividade(...) === "concluida"` de `lib/dominio/calculos.ts`; % do turno = `percentualCumprimento`.
- Semana = segunda a domingo; "hoje" = `hojeSaoPaulo()` de `lib/dominio/entrada.ts`.
- Textos da UI em pt-BR, exatamente: botão `Análise (PPC)`; vazio `Feche turnos para ver a análise.`; erro `Não foi possível carregar a análise. Tente novamente.`
- Percentuais formatados com `formatarPercentual` (`null` → `—`); datas com `formatarData`; período com `ROTULO_PERIODO`.
- Testes de domínio ficam em `tests/dominio/` (padrão do repo, não em `lib/`). Integração em `tests/integracao/` com `describe.skipIf(!ligado)`.
- Depois de concluir: `git push` da branch para gerar prévia no Vercel; merge na `main` só após validação do usuário.

## Review Focus

1. Domingo à noite em São Paulo (já segunda em UTC): a semana atual deve ser a que começa na segunda anterior, não a próxima — teste em `semanasDaAnalise`.
2. Turno fechado com data fora das N semanas (antes da primeira segunda ou depois do domingo atual) deve ser ignorado, não somado a uma semana — teste em `analisarObra`.
3. `?semanas=12&semanas=4` (array) ou `?semanas=abc` deve cair em 8, não quebrar — teste em `normalizarSemanas`.
4. Atividade com realizado acima do planejado conta como concluída (regra existente) — teste em `analisarObra`.
5. Descrição/observação longas no celular não podem gerar rolagem horizontal — usar `break-words` nas listas; conferir na prévia em largura de celular.

---

### Task 1: Cálculo puro da análise

**Files:**
- Create: `lib/dominio/analise.ts`
- Test: `tests/dominio/analise.test.ts`

**Interfaces:**
- Consumes: `statusAtividade`, `percentualCumprimento` (`lib/dominio/calculos.ts`); `compararTurnos` (`lib/dominio/regras.ts`); `CAUSAS`, `Causa`, `Periodo`, `StatusTurno` (`lib/dominio/tipos.ts`).
- Produces:
  ```ts
  export type OpcaoSemanas = 4 | 8 | 12;
  export type AtividadeAnalise = { descricao: string; qtd_planejada: number; qtd_realizada: number | null; causa: Causa | null; observacao: string | null };
  export type TurnoAnalise = { id: string; data: string; periodo: Periodo; status: StatusTurno; atividades: AtividadeAnalise[] };
  export type SemanaAnalise = { inicio: string; concluidas: number; total: number; ppc: number | null; atual: boolean; turnos: { id: string; data: string; periodo: Periodo; ppc: number | null }[] };
  export type CausaAnalise = { causa: Causa; rotulo: string; quantidade: number; fracao: number; atividades: { turnoId: string; data: string; periodo: Periodo; descricao: string; observacao: string | null }[] };
  export type Analise = { periodo: { concluidas: number; total: number; ppc: number | null }; semanas: SemanaAnalise[]; variacao: number | null; causas: CausaAnalise[] };
  export function normalizarSemanas(valor: unknown): OpcaoSemanas;
  export function inicioDaSemana(data: string): string;            // YYYY-MM-DD da segunda-feira
  export function semanasDaAnalise(hoje: string, n: number): string[]; // N segundas, crescente, última = semana de hoje
  export function analisarObra(turnos: TurnoAnalise[], semanas: string[]): Analise;
  ```

- [ ] **Step 1: Escrever os testes que falham** em `tests/dominio/analise.test.ts` (helper local `t(id, data, periodo, ativs, status = "fechado")` e `a(plan, real, causa?, obs?)`):
  - `normalizarSemanas`: `"4"→4`, `"12"→12`, `undefined→8`, `"99"→8`, `"abc"→8`, `["12","4"]→8`.
  - `inicioDaSemana`: `"2026-11-09"` (segunda) → `"2026-11-09"`; `"2026-11-15"` (domingo) → `"2026-11-09"`; `"2026-11-11"` → `"2026-11-09"`; `"2026-01-01"` (quinta) → `"2025-12-29"`.
  - `semanasDaAnalise("2026-11-15", 3)` → `["2026-10-26","2026-11-02","2026-11-09"]`.
  - Domingo à noite SP: `semanasDaAnalise(hojeSaoPaulo(new Date("2026-11-16T02:00:00Z")), 1)` → `["2026-11-09"]`.
  - PPC ponderado: semana com turno A (1 de 1 concluída) e turno B (1 de 3 concluída) → semana `{ concluidas: 2, total: 4, ppc: 0.5 }`, turnos com `ppc` `1` e `1/3`, em ordem `compararTurnos`.
  - Semana sem turno → `{ total: 0, ppc: null, turnos: [] }`; `atual` só `true` na última semana.
  - `variacao`: atual 0.5 e anterior 0.75 → `-0.25`; anterior sem turno → `null`.
  - Turnos com status `enviado`/`em_campo`/`planejado` ignorados; turno fechado sem atividades não soma e não aparece em `turnos`.
  - Turno fora do intervalo (data anterior à primeira segunda ou posterior ao domingo da última semana) ignorado.
  - Realizado > planejado conta como concluída.
  - Causas: 2× `material`, 1× `clima`, 1 concluída → `[{causa:"material", rotulo:"Material", quantidade:2, fracao:2/3}, {causa:"clima", quantidade:1, fracao:1/3}]`; atividades de cada causa em ordem cronológica com `turnoId`, `data`, `periodo`, `descricao`, `observacao`. Empate mantém ordem de primeira aparição. Não concluída sem causa não entra no ranking (e `fracao` usa só as que têm causa).
  - `periodo` soma todas as semanas; sem nada → `{ concluidas: 0, total: 0, ppc: null }`, `causas: []`.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `npx vitest run tests/dominio/analise.test.ts`
  Expected: FAIL (módulo `@/lib/dominio/analise` não existe).

- [ ] **Step 3: Implementar `lib/dominio/analise.ts`** com as assinaturas acima. Aritmética de datas em UTC (`new Date(data + "T00:00:00Z")`, `getUTCDay`, `setUTCDate`) para não depender do fuso da máquina. Semana de cada turno = `inicioDaSemana(t.data)`; ignora se não estiver em `semanas`. Ordenar turnos com `compararTurnos` antes de agregar (garante ordem cronológica das listas e empate estável das causas).

- [ ] **Step 4: Rodar e ver passar**
  Run: `npx vitest run tests/dominio/analise.test.ts`
  Expected: PASS. Depois `npx vitest run` (suite toda) também PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add lib/dominio/analise.ts tests/dominio/analise.test.ts
  git commit -m "feat(analise): cálculo de PPC semanal e ranking de causas"
  ```

### Task 2: Consulta dos turnos fechados

**Files:**
- Modify: `lib/db/turnos.ts` (nova função após `listarTurnosComAtividades`)
- Test: `tests/integracao/turnos.test.ts` (novo `it` no `describe` existente)

**Interfaces:**
- Consumes: `TurnoAnalise` (Task 1); `COLUNAS_TURNO` não é necessário — selecionar só `id, data, periodo, status`.
- Produces: `export async function listarTurnosFechadosParaAnalise(c: SupabaseClient, obraId: string, desde: string): Promise<TurnoAnalise[]>`

- [ ] **Step 1: Escrever o teste de integração que falha**: `it("listarTurnosFechadosParaAnalise traz só fechados a partir de desde")` — criar 3 turnos (`2026-10-01` fechado, `2026-11-03` fechado, `2026-11-04` só planejado) com uma atividade cada (`adicionarAtividade`, `qtd_planejada: 10`). Para fechar, seguir `tests/integracao/execucao.test.ts`: `aplicarAcao(c, id, "liberar")` → `salvarExecucaoPlanejador(c, id, ativId, { qtd_realizada: 4, causa: "material", observacao: "x" })` → `aplicarAcao(c, id, "fechar")`. Chamar com `desde = "2026-11-02"` e esperar exatamente 1 turno (`2026-11-03`), `status: "fechado"`, atividades com `qtd_planejada` e `qtd_realizada` do tipo `number`, e `causa`/`observacao`/`descricao` preenchidos.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `SUPABASE_TEST=1 npx vitest run tests/integracao/turnos.test.ts` (com `.env` do Supabase dev)
  Expected: FAIL (função não exportada).

- [ ] **Step 3: Implementar** `listarTurnosFechadosParaAnalise`: `.from("turnos").select("id, data, periodo, status, atividades(descricao, qtd_planejada, qtd_realizada, causa, observacao, ordem)").eq("obra_id", obraId).eq("status", "fechado").gte("data", desde)`. Converter quantidades com `Number` como em `listarTurnosComAtividades`; ordenar atividades por `ordem` e descartar o campo `ordem` no retorno. Erro: `console.error("listarTurnosFechadosParaAnalise:", ...)` + `throw new Error(...)`.

- [ ] **Step 4: Rodar e ver passar**
  Run: `SUPABASE_TEST=1 npx vitest run tests/integracao/turnos.test.ts`
  Expected: PASS. Se o Supabase dev não estiver disponível, registrar que o teste ficou pulado (não declarar como passou).

- [ ] **Step 5: Commit**
  ```bash
  git add lib/db/turnos.ts tests/integracao/turnos.test.ts
  git commit -m "feat(analise): consulta de turnos fechados para a análise"
  ```

### Task 3: Página de análise e acesso pela obra

**Files:**
- Create: `app/(app)/obras/[obraId]/analise/page.tsx`
- Create: `app/(app)/obras/[obraId]/analise/Barra.tsx` (barra horizontal: `{ rotulo: string; fracao: number | null; texto: string; destaque?: boolean }`)
- Modify: `app/(app)/obras/[obraId]/page.tsx` (link `Análise (PPC)` com `classesBotao("secundario")` ao lado de "Novo turno")
- Test: `tests/e2e/ciclo-turno.spec.ts`

**Interfaces:**
- Consumes: `normalizarSemanas`, `semanasDaAnalise`, `analisarObra` (Task 1); `listarTurnosFechadosParaAnalise` (Task 2); `obterObra`, `criarClienteServidor`, `hojeSaoPaulo`, `formatarPercentual`, `formatarData`, `ROTULO_PERIODO`, `Cartao`, `Aviso`.
- Produces: rota `/obras/[obraId]/analise?semanas=N`.

- [ ] **Step 1: Estender o E2E** (teste falha primeiro): logo após `Reabrir turno` ficar visível e antes do RDO, voltar à obra, clicar no link `Análise (PPC)`, esperar URL `**/analise`, e conferir: texto `50%` no bloco de indicadores; `1 de 2 atividades`; a causa `Material` com `1 (100%)`; abrir a causa e ver `Alvenaria`. Depois `page.goto(turnoUrl)` para seguir o fluxo do RDO como antes.

- [ ] **Step 2: Rodar e ver falhar**
  Run: `SUPABASE_TEST=1 npx playwright test tests/e2e/ciclo-turno.spec.ts`
  Expected: FAIL (link `Análise (PPC)` não existe).

- [ ] **Step 3: Implementar a página.** Assinatura: `export default async function AnalisePage({ params, searchParams }: { params: Promise<{ obraId: string }>; searchParams: Promise<{ [k: string]: string | string[] | undefined }> })`. Fluxo: `obterObra` → `notFound()` se nula; `n = normalizarSemanas(sp.semanas)`; `semanas = semanasDaAnalise(hojeSaoPaulo(), n)`; `try { turnos = await listarTurnosFechadosParaAnalise(supabase, obraId, semanas[0]) } catch { <Aviso tom="perigo">texto de erro</Aviso> }`; `analise = analisarObra(turnos, semanas)`. Se `analise.periodo.total === 0` → `Cartao` com o texto vazio. Layout conforme a spec (seção "Tela"): cabeçalho com nome da obra, voltar para a obra e seletor `4 | 8 | 12 sem` como `Link`s para `?semanas=N` (o ativo com `aria-current="page"`); indicadores (`PPC do período: X% — C de T atividades`; `Semana atual: X%` e variação `▲/▼ N pts vs anterior` só quando `variacao !== null`); seção `PPC por semana` (rótulo `dd/mm` da segunda, `<details>` só para semanas com turnos, cada turno como `Link` para `/obras/[obraId]/turnos/[id]` com data, período e %); seção `Causas de não cumprimento` (`Barra` com texto `Q (P%)`, `<details>` com `data · período · descrição` e observação em linha menor). Seções com `aria-labelledby` (`titulo-indicadores`, `titulo-semanas`, `titulo-causas`) para o E2E. Listas com `break-words`.

- [ ] **Step 4: Verificar**
  Run: `npx tsc --noEmit && npm run lint && npx vitest run && SUPABASE_TEST=1 npx playwright test`
  Expected: tudo sem erros; E2E PASS. Também `npm run build` sem erros.

- [ ] **Step 5: Commit**
  ```bash
  git add "app/(app)/obras/[obraId]/analise" "app/(app)/obras/[obraId]/page.tsx" tests/e2e/ciclo-turno.spec.ts
  git commit -m "feat(analise): tela de PPC e causas por obra"
  ```

### Task 4: Prévia no Vercel

- [ ] **Step 1:** `git push -u origin analise-ppc` (Vercel CLI está deslogado; a prévia sai do push).
- [ ] **Step 2:** Pegar a URL da prévia do deploy da branch (via `gh` não instalado → pedir ao usuário o link no painel do Vercel, aba Deployments) e pedir validação: abrir uma obra com turnos fechados, conferir PPC, trocar 4/8/12, abrir semana e causa, testar no celular (Review Focus 5).
- [ ] **Step 3:** Só após o "ok" do usuário: merge na `main` (`git checkout main && git merge --no-ff analise-ppc && git push`) e checar www.frentia.com.br/obras/<id>/analise.
