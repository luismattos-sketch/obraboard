# Sinal fraco de canteiro + "Salvo ✓" enganoso — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O auto-salvamento nunca desiste, tenta de novo na volta da rede/da tela/num botão, nunca mostra verde antes da confirmação, e avisa (topo + pergunta ao sair) enquanto houver lançamento não salvo.

**Architecture:** `decidirRepeticao` vira "sempre repete" com intervalo crescente. `useAutoSalvar` informa ao registro central (`rastreioSalvamento`) o estado de cada bloco ("salvando"/"falhou") e como antecipar; o registro alimenta o aviso fixo no topo, o `beforeunload` e o bloqueio do "Enviar turno". Indicador e selo passam a refletir só o que o banco confirmou.

**Tech Stack:** Next.js 16, React 19, Vitest, Playwright.

**Spec:** [docs/superpowers/specs/2026-11-16-sinal-fraco-design.md](../specs/2026-11-16-sinal-fraco-design.md)

## Global Constraints
- Nunca `localStorage`/`sessionStorage`/IndexedDB/service worker; nada do pendente é guardado no celular.
- Textos pt-BR; nunca "encarregado" em texto visível.
- Intervalos de repetição: 5 s, 10 s, 20 s, 30 s e depois 30 s sempre. Sem conexão: 30 s (e na hora no evento `online`).
- Textos exatos: indicador `Não salvo — sem sinal. Tentando de novo…`; botão `Tentar de novo`;
  aviso `⚠ 1 lançamento não salvo. Não feche nem atualize esta tela.` / `⚠ N lançamentos não salvos. Não feche nem atualize esta tela.`
- Some a mensagem `Não foi possível salvar. Recarregue a página.` (e `MAX_REPETICOES`).
- Erro de negócio (`ok:false`) não repete e não conta como "não salvo" no aviso do topo.
- Rodar vitest/playwright pelo PowerShell com `Set-Location 'C:\Users\LuisVillaca\Documents\ObraApp'` (C: maiúsculo).
- Ao fim: deploy no Vercel.

## Review Focus
1. Erro de negócio (número inválido "abc", conflito, turno fechado) não pode virar aviso no topo nem repetir para sempre. (Task 4, passo "abc".)
2. Nova edição durante uma falha (digita 3, falha, digita 7): o banco termina com 7, nunca com 3 chegando depois. (Task 4, passo "3 depois 7".)
3. Vários blocos falhando: o aviso conta certo (plural). (Task 1, teste de texto; Task 4 com 2 blocos.)
4. Salvamento normal rápido (rede boa) não pode piscar o aviso do topo: ele só aparece após uma falha. (Task 4, passo inicial com rede boa.)
5. Planejador: mesma tela de correção ganha aviso e pergunta ao sair, sem quebrar a revalidação. (Task 3: `EdicaoExecucao` usa os mesmos componentes; suíte E2E existente `ciclo-turno` continua passando.)

---

### Task 1: Regra de repetição e textos

**Files:**
- Modify: `components/execucao/repeticao.ts`, `tests/dominio/invariantes.test.ts:16-31`
- Test: `tests/dominio/invariantes.test.ts`

**Interfaces:**
- Produces (em `repeticao.ts`):
  - `INTERVALOS_REPETIR_MS = [5000, 10000, 20000, 30000] as const`
  - `decidirRepeticao(falhas: number, online: boolean): { falhas: number; emMs: number }` — online: `falhas+1` e `INTERVALOS[min(falhas, 3)]`; offline: `{ falhas, emMs: 30000 }`.
  - `MSG_SEM_SINAL = "Não salvo — sem sinal. Tentando de novo…"`
  - `textoPendentes(n: number): string`
  - Remove `ERRO_DESISTIU`, `MAX_REPETICOES`, `INTERVALO_REPETIR_MS`.

- [ ] **Step 1:** Trocar o `describe("decidirRepeticao …")` por:
```ts
it("nunca desiste e aumenta o intervalo até 30 s", () => {
  let f = 0;
  const vistos: number[] = [];
  for (let i = 0; i < 8; i++) { const d = decidirRepeticao(f, true); vistos.push(d.emMs); f = d.falhas; }
  expect(vistos).toEqual([5000, 10000, 20000, 30000, 30000, 30000, 30000, 30000]);
  expect(f).toBe(8);
});
it("sem conexão espera 30 s sem contar falha", () => {
  expect(decidirRepeticao(2, false)).toEqual({ falhas: 2, emMs: 30000 });
});
it("texto do aviso no topo", () => {
  expect(textoPendentes(1)).toBe("⚠ 1 lançamento não salvo. Não feche nem atualize esta tela.");
  expect(textoPendentes(2)).toBe("⚠ 2 lançamentos não salvos. Não feche nem atualize esta tela.");
  expect(MSG_SEM_SINAL).toBe("Não salvo — sem sinal. Tentando de novo…");
});
```
- [ ] **Step 2:** `npx vitest run tests/dominio/invariantes.test.ts` → FAIL.
- [ ] **Step 3:** Implementar em `repeticao.ts`; ajustar o único chamador (`useAutoSalvar.ts`) só o necessário para compilar (o ramo "desistiu" some).
- [ ] **Step 4:** `npx vitest run tests/dominio` e `npx tsc --noEmit` → PASS.
- [ ] **Step 5:** Commit `feat(salvar): nunca desiste, intervalo crescente`.

### Task 2: Registro central, auto-salvar e indicador

**Files:**
- Modify: `components/execucao/rastreioSalvamento.tsx`, `components/execucao/useAutoSalvar.ts`, `components/execucao/IndicadorSalvo.tsx`, `components/execucao/BlocoAtividades.tsx`, `BlocoEfetivo.tsx`, `BlocoClima.tsx`, `BlocoHorario.tsx` (repassar `tentar` ao indicador), `app/t/[token]/FormularioCampo.tsx`, `app/(app)/obras/[obraId]/turnos/[turnoId]/EdicaoExecucao.tsx`
- Test: `tests/dominio/indicador-salvo.test.tsx`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `type EstadoPendente = "salvando" | "falhou"`; `Registrar = (id: string, estado: EstadoPendente | null, antecipar?: () => void) => void`
  - `useRastreioSalvamento(): { ocupado: boolean; falhas: number; tentarTodos: () => void; registrar: Registrar }` — `ocupado` = algum bloco pendente; `falhas` = blocos em "falhou"; registra `beforeunload` (com `preventDefault()` e `returnValue = ""`) enquanto `ocupado`.
  - `useAutoSalvar(...)` devolve `EstadoSalvar & { tentar: () => void }`. Na mudança de `deps`: `estado:"salvando"` e `registrar(id,"salvando")` **na hora** (antes do debounce). Falha de rede: `estado:"erro"` sem `mensagem`, `registrar(id,"falhou",antecipar)`, reagenda por `decidirRepeticao`. Antecipa também em `visibilitychange` para `visible` e em `online` (já antecipa ao esconder). Sucesso ou erro de negócio: `registrar(id,null)`.
  - `IndicadorSalvo` com `estado:"erro"` sem `mensagem`: `MSG_SEM_SINAL` + botão `Tentar de novo` (prop `tentar?: () => void`).

- [ ] **Step 1: Teste** em `indicador-salvo.test.tsx`:
  - `<IndicadorSalvo estado="erro" tentar={() => {}} />` → contém `Não salvo — sem sinal. Tentando de novo…` e `Tentar de novo`.
  - `<IndicadorSalvo estado="erro" mensagem="Digite um número válido" tentar={() => {}} />` → contém a mensagem e **não** contém `Tentar de novo`.
- [ ] **Step 2:** `npx vitest run tests/dominio/indicador-salvo.test.tsx` → FAIL.
- [ ] **Step 3:** Implementar as interfaces acima. "Enviar turno" segue usando `ocupado` (agora fica travado durante a falha, pois não há mais desistência).
- [ ] **Step 4:** `npx vitest run tests/dominio`, `npx tsc --noEmit`, `npm run lint` → PASS.
- [ ] **Step 5:** Commit `feat(salvar): estado pendente central, Salvando imediato e Tentar de novo`.

### Task 3: Aviso no topo, selo neutro e atualizar quando a rede volta

**Files:**
- Create: `components/execucao/AvisoPendentes.tsx`
- Modify: `components/ui/Selo.tsx` (atributo `data-tom={tom}`), `components/execucao/BlocoAtividades.tsx`, `components/execucao/useAtualizarAoVoltar.ts`, `app/t/[token]/FormularioCampo.tsx`, `app/(app)/obras/[obraId]/turnos/[turnoId]/EdicaoExecucao.tsx`
- Test: `tests/dominio/indicador-salvo.test.tsx`

**Interfaces:**
- Consumes: `useRastreioSalvamento().falhas/tentarTodos`, `textoPendentes`.
- Produces: `AvisoPendentes({ falhas: number; tentar: () => void })` — `null` com 0; senão faixa fixa no alto (`sticky top-0`, `role="alert"`, tons de alerta) com `textoPendentes(falhas)` e botão `Tentar de novo`.

- [ ] **Step 1: Testes:** `AvisoPendentes` com `falhas={0}` → `""`; com `falhas={2}` → contém `2 lançamentos não salvos` e `Tentar de novo`. `Selo` renderiza `data-tom="neutro"`.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3: Implementar.** Selo da atividade: `tom = estado.estado === "ocioso" || estado.estado === "salvo" ? TOM[status] : "neutro"`. `AvisoPendentes` no topo dos dois formulários. `useAtualizarAoVoltar` também chama `router.refresh()` no evento `online` (mesma condição `!ocupado`).
- [ ] **Step 4:** `npx vitest run tests/dominio`, `npx tsc --noEmit`, `npm run lint` → PASS.
- [ ] **Step 5:** Commit `feat(salvar): aviso de não salvo no topo e selo neutro até confirmar`.

### Task 4: E2E de sinal fraco

**Files:**
- Create: `tests/e2e/sinal-fraco.spec.ts`

**Interfaces:**
- Consumes: helpers de `tests/integracao/ajuda.ts` (`criarUsuarioTeste`, `removerUsuarioTeste`), `criarObra`, `criarTurno`, `adicionarAtividade`, `aplicarAcao(...,"liberar")` (devolve `token`), `criarClienteAdmin`. Sem login pela tela: abre `/t/${token}` num contexto `devices["Pixel 7"]`.

- [ ] **Step 1: Escrever o teste** (`test.skip` sem `SUPABASE_TEST=1`; `test.setTimeout(180_000)`; turno com 2 atividades de 10 m). "Rede que finge" = `page.route("**/*", r => r.request().method() === "POST" ? r.abort("connectionreset") : r.continue())`. Pré-aquecer `/t/${token}` com `page.request.get`. Passos e asserções:
  1. Rede boa: card 0 Executado `2` → "Salvo ✓"; o aviso do topo **nunca** apareceu (`getByText(/não salvo\./)` com count 0).
  2. Editar card 0 para `3` → no mesmo instante `getByText("Salvo ✓")` do card 0 tem count 0 e "Salvando…" visível.
  3. Ligar rede que finge. Card 0 `5` e card 1 `4` → ambos "Não salvo — sem sinal…"; topo `2 lançamentos não salvos`; botão "Enviar turno" desabilitado; selo do card 0 com `data-tom="neutro"`.
  4. Card 0 muda para `7` durante a falha. `waitForTimeout(40_000)` → ainda "Não salvo…", sem `Recarregue a página`.
  5. Card 1 Executado `abc` → "Digite um número válido"; topo conta **1** (só o card 0).
  6. `unroute`; tocar "Tentar de novo" do topo → card 0 "Salvo ✓"; banco (`admin`) `qtd_realizada` do card 0 = 7; aviso some. Corrigir card 1 para `4` → "Salvo ✓".
  7. `ctx.setOffline(true)`; card 0 `8` → "Não salvo…"; `ctx.setOffline(false)` → "Salvo ✓" em até 15 s sem tocar nada; banco = 8.
  8. Rede que finge de novo; card 0 `9` → "Não salvo…"; `page.on("dialog")` captura; `page.close({ runBeforeUnload: true })` → diálogo do tipo `beforeunload` (dar `dismiss`).
- [ ] **Step 2:** `SUPABASE_TEST=1 npx playwright test tests/e2e/sinal-fraco.spec.ts` → PASS (Tasks 1–3 já feitas; se algum passo falhar, é bug a corrigir, não o teste).
- [ ] **Step 3:** Rodar tudo: `SUPABASE_TEST=1 npx vitest run` e `SUPABASE_TEST=1 npx playwright test` → PASS.
- [ ] **Step 4:** Commit `test(e2e): sinal fraco de canteiro`; marcar itens 2 e 3 como feitos em `docs/backlog.md`.
