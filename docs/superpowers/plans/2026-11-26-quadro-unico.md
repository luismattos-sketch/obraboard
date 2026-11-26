# Quadro único com clima — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um só quadro público (sem login), fase CHECK-IN/CHECK-OUT automática, sem foto de check-in, com resumo do clima.

**Architecture:** `/q/[codigo]` passa a ser o único quadro. A fase sai do modelo (alguma equipe iniciou → checkout). `prepararQuadro` deixa de ler `checkin_fotos` e de aceitar `?visao=`; passa a trazer o clima via `climaParaTela` (que ganha previsão no turno planejado).

**Tech Stack:** Next.js (ler `node_modules/next/dist/docs/` antes), Supabase, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-26-quadro-unico-design.md`

## Global Constraints
- Nunca `localStorage`/`sessionStorage`.
- Termo "Responsável", nunca "encarregado".
- Testes Vitest rodam com cwd `C:\` maiúsculo (PowerShell).
- Não apagar `checkin_fotos` nem dados; só parar de gravar/ler.
- Ao final: manual (`lib/ajuda/`), capturas, fluxograma, Novidades, deploy Vercel.

## Review Focus
1. Turno fechado/enviado sem nenhuma equipe iniciada → selo CHECK-OUT (não CHECK-IN).
2. Link antigo com `?visao=checkin` → ignorado, sem erro.
3. Obra sem cidade → nenhum cartão de clima, sem aviso.
4. Open-Meteo fora do ar → quadro carrega, cartão de clima some.
5. Obra sem link gerado → botão "Quadro" da obra leva ao cartão "Link do quadro", não a 404.

---

### Task 1: Fase automática no domínio

**Files:**
- Modify: `lib/dominio/quadro.ts` (remover `visaoValida`, `visaoPadrao`; adicionar `faseDoQuadro`)
- Test: `tests/dominio/quadro.test.ts`

**Interfaces:**
- Produces: `faseDoQuadro(m: ModeloQuadro): Visao` — `"checkout"` se `m.entrada.turno.status` for `"enviado"` ou `"fechado"`, ou se alguma `m.faixas[i].resumo.iniciouEm !== null`; senão `"checkin"`.

- [ ] Step 1: testes `faseDoQuadro`: planejado sem iniciados → `"checkin"`; em_campo sem iniciados → `"checkin"`; em_campo com uma faixa `iniciouEm: "07:10"` → `"checkout"`; fechado sem iniciados → `"checkout"`. Remover testes de `visaoValida`/`visaoPadrao`.
- [ ] Step 2: rodar `npx vitest run tests/dominio/quadro.test.ts` → FAIL.
- [ ] Step 3: implementar; remover `visaoValida`/`visaoPadrao` e usos.
- [ ] Step 4: rodar → PASS.
- [ ] Step 5: commit `feat(quadro): fase automática check-in/check-out`.

### Task 2: Previsão do clima no turno planejado

**Files:**
- Modify: `lib/clima/obter.ts`, `lib/clima/tela.ts`
- Test: `tests/dominio/clima.test.ts`

**Interfaces:**
- Produces: `obterClimaTurno(obra, turno, { agora?, revalidar?, previsao?: boolean })` — com `previsao`, usa `janela.fim` como "agora" (janela inteira).
- Produces: `climaParaTela(turno, { previsao?: boolean })` — status `"planejado"` com `previsao: true` busca previsão (cache 30 min) e retorna `{ clima, aviso, parcial: false, previsao: true }`. `ClimaNaTela` ganha `previsao: boolean` (false nos demais casos). Sem `previsao` o comportamento atual não muda (RDO).

- [ ] Step 1: teste com `buscarHoras` mockado: turno planejado + `previsao: true` → `clima.leituras` cobre a janela inteira e `previsao === true`; sem a opção → `aviso: "indisponivel"`.
- [ ] Step 2: rodar → FAIL. Step 3: implementar. Step 4: rodar → PASS.
- [ ] Step 5: commit `feat(clima): previsão para turno planejado`.

### Task 3: Quadro único (componente + preparação + rotas)

**Files:**
- Modify: `components/quadro/prepararQuadro.ts`, `components/quadro/Quadro.tsx`, `app/q/[codigo]/page.tsx`
- Delete: `app/(app)/obras/[obraId]/quadro/page.tsx` (vira `redirect` para `/obras/[obraId]#link-quadro`)
- Modify: `app/(app)/obras/[obraId]/page.tsx:45` — botão "Quadro" abre `urlQuadro(codigo)` em nova aba se houver código; senão âncora `#link-quadro`. `LinkQuadro` ganha `id="link-quadro"`.
- Test: `tests/dominio/quadro-ui.test.tsx`, `tests/integracao/quadro.test.ts`

**Interfaces:**
- Consumes: `faseDoQuadro` (Task 1), `climaParaTela(turno, { previsao: true })` (Task 2).
- Produces: `PropsQuadro` sem `seletor`, `editarHref`, `publico`; com `clima?: ClimaNaTela`. `prepararQuadro(c, obraId, busca: { turno? }, base)` — ignora `visao`, não lê `fotoCheckin`, remove `AVISO_SEM_REGISTRO`; busca latitude/longitude da obra e o clima.
- Cartão do clima no quadro: `ResumoClima` em `components/quadro/BlocosQuadro.tsx` — uma linha: ícone pela condição (`rotuloTempo`), `máx X° · mín Y°`, `textoChuva`; título "Previsão" (planejado), "Clima até agora" (parcial) ou "Clima". Clima `null` → não renderiza nada.

- [ ] Step 1: testes UI: sem links "Check-in"/"Check-out"/"Editar"; selo "CHECK-IN" com faixas sem `iniciouEm`, "CHECK-OUT" com uma iniciada; `ResumoClima` mostra "máx 30° · mín 21°" e "Previsão"; clima null → sem `aria-label="Clima"`. Integração: `?visao=checkin` ignorado; `prepararQuadro` não consulta `checkin_fotos`.
- [ ] Step 2: rodar → FAIL. Step 3: implementar. Step 4: `npx vitest run` + `npx tsc --noEmit` → PASS.
- [ ] Step 5: commit `feat(quadro): quadro único público com clima`.

### Task 4: Parar a foto do check-in

**Files:**
- Create: `supabase/migrations/20261126000000_sem_foto_checkin.sql` — `drop trigger turnos_emitir_checkin on public.turnos;` (tabela e função ficam).
- Delete: `app/(app)/obras/[obraId]/turnos/[turnoId]/checkin/page.tsx`; em `.../[turnoId]/page.tsx` remover `temFoto` e passar `checkinHref={null}` (ou remover a prop de `HistoricoTurno`).
- Test: `tests/integracao/quadro-banco.test.ts` — iniciar turno não cria linha em `checkin_fotos`.

- [ ] Steps: teste → FAIL; migração aplicada (`supabase db push` no banco de teste) → PASS; commit `feat(quadro): para de gravar foto do check-in`.

### Task 5: E2E, manual e deploy

**Files:** `tests/e2e/quadro.spec.ts`, `lib/ajuda/` (capítulo do quadro), `lib/ajuda/fluxograma.ts`, `lib/ajuda/novidades.ts`

- [ ] E2E: abrir `/q/<código>` sem login; selo CHECK-IN antes de "Iniciar turno" da equipe, CHECK-OUT depois; sem "Editar".
- [ ] Manual + Novidades ("Quadro único: abre só pelo link, mostra check-in/check-out sozinho e o clima do turno"); fluxograma sem a etapa de foto do check-in.
- [ ] `SUPABASE_TEST=1 MANUAL_CAPITULO=quadro npm run manual:capturas`.
- [ ] `npx vitest run`, `npx playwright test tests/e2e/quadro.spec.ts` → PASS; commit; merge; migração em produção; deploy Vercel.
