# Quadro: resumo do turno e PPC dia a dia na Análise — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No quadro, um resumo do turno (anel de cumprimento + ritmo tempo × avanço + aderência da obra); o "PPC do mês" vira "PPC dia a dia" na Análise.

**Architecture:** Funções puras em `lib/dominio/ritmo.ts` (novo) e `lib/dominio/ppcMes.ts` (generalizado para intervalo). `prepararQuadro` troca a leitura do mês pela dos turnos fechados da obra inteira (aderência). Componentes de apresentação em `components/quadro/BlocosQuadro.tsx`.

**Tech Stack:** Next.js 16.2.6 (App Router), React 19, Tailwind 4, Supabase, Vitest, Playwright (capturas).

**Spec:** `docs/superpowers/specs/2026-11-24-quadro-ritmo-turno-design.md`

## Global Constraints

- Farol: verde ≥ 80%, amarelo 60–79%, vermelho < 60% (`farol()` de `ppcMes.ts`).
- "⚠ abaixo do ritmo" quando avanço < tempo − 0,15; senão "no ritmo". Turno fechado: "Resultado final", sem barra de tempo.
- Extra e adiantada fora de tudo (`contaNoDia`).
- Sem `localStorage`/`sessionStorage`. Textos em pt-BR; termo "Responsável".
- Manual (`lib/ajuda/conteudo/quadro-tv.ts` e capítulo da análise), capturas e Novidades no mesmo PR.

## Review Focus

- Turno sem hora prevista (início/fim nulos) → sem barra de tempo, só avanço (teste em Task 1).
- Turno noturno que vira a meia-noite (fim < início) → tempo calculado somando 24 h ao fim (teste em Task 1).
- Turno sem atividades programadas (só extra) → anel "sem atividades programadas", sem farol (teste em Task 1).
- Obra sem nenhum turno fechado → "Aderência da obra: sem turno fechado" (teste em Task 1).
- Período da Análise atravessando dois meses → um dia por data do período, rótulo dd/mm no 1º dia de cada mês (teste em Task 3).

---

### Task 1: Domínio do resumo do turno

**Files:**
- Create: `lib/dominio/ritmo.ts`
- Test: `tests/dominio/ritmo.test.ts`

**Interfaces:**
- Produces:
  - `type ResumoTurno = { concluidas: number; andamento: number; naoIniciadas: number; total: number; cumprimento: number | null; avanco: number | null; tempo: number | null; ritmo: "abaixo" | "no_ritmo" | null; fechado: boolean }`
  - `resumoDoTurno(turno: { status: StatusTurno; hora_inicio_prevista: string | null; hora_fim_prevista: string | null }, atividades: { qtd_planejada: number; qtd_realizada: number | null; tipo?: TipoAtividade | null }[], agora?: string): ResumoTurno`
  - `aderencia(turnos: { atividades: { qtd_planejada: number; qtd_realizada: number | null }[] }[]): { concluidas: number; total: number; ppc: number | null }`

- [ ] **Step 1: Write failing tests** — `ritmo.test.ts`:
  - 7 programadas (4 concluídas, 2 parciais a 50%, 1 zerada) + 1 extra; janela 07:00–17:00, agora "13:12" → `concluidas 4, andamento 2, naoIniciadas 1, total 7, cumprimento 4/7, avanco (4+0.5+0.5)/7, tempo 0.62, ritmo "abaixo"`.
  - realizado acima do planejado conta 1 (min).
  - agora antes do início → tempo 0; depois do fim → tempo 1; `agora` undefined e status ≠ fechado → tempo null, ritmo null.
  - noturno 19:00–05:00, agora "01:00" → tempo 0.6.
  - horas nulas → tempo null.
  - status "fechado" → `fechado: true, tempo: null, ritmo: null`.
  - só extra → `total 0, cumprimento null, avanco null`.
  - avanço 0.50, tempo 0.64 → "no_ritmo" (diferença 0.14); tempo 0.66 → "abaixo".
  - `aderencia([])` → `{0,0,null}`; dois turnos 1/2 e 2/2 → `{3,4,0.75}`.
- [ ] **Step 2: Run** `npx vitest run tests/dominio/ritmo.test.ts` (PowerShell, cwd `C:\…`) → FAIL (módulo não existe).
- [ ] **Step 3: Implement** usando `statusAtividade`, `contaNoDia`, `minutos` de `calculos.ts`; tempo = (agora − início) ÷ (fim − início), limitado a [0, 1], com +1440 min no fim e no agora quando cruzam a meia-noite.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(quadro): resumo do turno e aderência (domínio)`

### Task 2: Resumo no quadro e saída do PPC do mês

**Files:**
- Modify: `components/quadro/prepararQuadro.ts` (trocar `listarTurnosFechadosParaAnalise(c, obraId, mes-01)` por `(c, obraId, "0001-01-01")`; props `aderenciaObra` e `agora` no lugar de `ppcMes`)
- Modify: `components/quadro/Quadro.tsx` (props `aderenciaObra?: {concluidas,total,ppc|null}`, `agora?: string`; remove `ppcMes`; renderiza `ResumoDoTurno` após paradas, antes das faixas)
- Modify: `components/quadro/BlocosQuadro.tsx` (remove `PpcDoMes` daqui — move para Task 3; cria `ResumoDoTurno({ resumo, aderenciaObra, visao })`)
- Test: `tests/dominio/quadro-ui.test.tsx` (acrescentar)

**Interfaces:**
- Consumes: `resumoDoTurno`, `aderencia` (Task 1); `farol` (`ppcMes.ts`).

- [ ] **Step 1: Write failing tests** (renderToStaticMarkup, como os existentes):
  - check-out com o cenário da Task 1 → contém `region` "Resumo do turno", "4 de 7 concluídas", "57%", "Tempo do turno", "⚠ abaixo do ritmo", "Aderência da obra".
  - turno fechado → contém "Resultado final", não contém "Tempo do turno".
  - check-in → não contém "4 de 7 concluídas"; contém "Aderência da obra".
  - aderência `{0,0,null}` → "Aderência da obra: sem turno fechado".
  - não contém "PPC do mês".
- [ ] **Step 2: Run** `npx vitest run tests/dominio/quadro-ui.test.tsx` → FAIL.
- [ ] **Step 3: Implement.** Anel em SVG (círculo com `stroke-dasharray`, cor pelo farol, % no centro, `aria-hidden`; o texto ao lado leva a informação). Barras com as mesmas classes de cor; tempo em `bg-operacional`. Layout `md:grid-cols-[auto_1fr]`, empilhado no celular. O `agora` vem de `agoraDoTurno(...)`, que já é calculado em `prepararQuadro`.
- [ ] **Step 4: Run** → PASS; `npx tsc --noEmit`, `npx eslint components/quadro`.
- [ ] **Step 5: Commit** `feat(quadro): resumo do turno com anel e ritmo; PPC do mês sai do quadro`

### Task 3: PPC dia a dia na Análise

**Files:**
- Modify: `lib/dominio/ppcMes.ts` → `ppcPorDia(turnos, inicio: string, fim: string): { dias: DiaPpc[]; aderencia }` (um item por data de `inicio` a `fim`, inclusive); remover `ppcDoMes` e o tipo `PpcMes` se não houver mais uso.
- Create: `components/analise/PpcDiaADia.tsx` (o gráfico de barras que era `PpcDoMes`, título "PPC dia a dia", `aria-label` igual ao título, rótulo do dia = número, e "dd/mm" no 1º dia de cada mês e no 1º dia do período)
- Modify: `app/(app)/obras/[obraId]/analise/page.tsx` (seção após "PPC por semana", `ppcPorDia(turnos, semanas[0], hojeSaoPaulo())`)
- Test: `tests/dominio/ppc-mes.test.ts` (reescrever para `ppcPorDia`)

- [ ] **Step 1: Tests:** `ppcPorDia` de "2026-10-30" a "2026-11-02" → 4 dias, datas certas, turnos fora do intervalo ignorados; aderência soma só o intervalo; `farol` mantém os testes atuais.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; tsc/eslint.
- [ ] **Step 5: Commit** `feat(analise): PPC dia a dia com farol`

### Task 4: Manual, capturas, Novidades, planilha, deploy

**Files:**
- Modify: `lib/ajuda/conteudo/quadro-tv.ts` (passo `ppc-mes` vira `resumo-turno`: anel, ritmo, aderência; alvo `region` "Resumo do turno")
- Modify: capítulo da análise em `lib/ajuda/conteudo/` (novo passo `ppc-dia-a-dia`, alvo `region` "PPC dia a dia")
- Modify: `tests/manual/capturas.spec.ts` (`fotografar(tv, "quadro-tv", "resumo-turno")` no lugar de `ppc-mes`; `fotografar(pl, <capítulo da análise>, "ppc-dia-a-dia")` na Análise)
- Delete: `public/ajuda/quadro-tv-ppc-mes.png`
- Modify: `lib/ajuda/novidades.ts` (linha nova de 2026-11-24 no topo)

- [ ] **Step 1:** editar o conteúdo e o roteiro.
- [ ] **Step 2: Run** `$env:SUPABASE_TEST='1'; npm run manual:capturas` → passa; conferir as 2 imagens novas.
- [ ] **Step 3: Run** `npx vitest run` com `SUPABASE_TEST=1` → PASS.
- [ ] **Step 4: Commit** `docs(manual): resumo do turno e PPC dia a dia`; merge na `main`, push, conferir o deploy na Vercel (se aparecer "throttled": `npx vercel redeploy <url> --target production`); anotar na nota do 2.4 na planilha.
