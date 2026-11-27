# Página do turno mais curta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A página do turno abre com o que serve para acompanhar e cobrar; "Fechar turno" fica no cabeçalho; o resto recolhido; "Remover" discreto.

**Architecture:** Um componente `Recolhivel` (`<details>` com `open` controlável) passa a envolver as seções secundárias. Um novo componente cliente `TurnoEmExecucao` assume o estado que hoje vive em `EdicaoExecucao` (lista local, pendências, `cobrado`, `ocupado`) para que o botão do cabeçalho, a área de fechamento no topo e "Corrigir execução" recolhido compartilhem esse estado. O `page.tsx` (servidor) só monta os blocos e os passa como `ReactNode`.

**Tech Stack:** Next.js (App Router, ver `node_modules/next/dist/docs/` antes de mexer), React 19 (`useActionState`), Tailwind, Vitest (`renderToStaticMarkup`), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-26-pagina-do-turno-design.md`

## Global Constraints

- Nada de `localStorage`/`sessionStorage`: seções recolhidas voltam fechadas a cada visita.
- Termo "responsável", nunca "encarregado", em qualquer texto novo.
- Textos de botões existentes mantidos exatamente: "Fechar turno", "Confirmar fechamento", "Cancelar", "Reabrir turno", "Remover", "Gerar link", "Ir para a causa: <descrição>" (aria-label).
- Sem mudança em regras de fechamento/causa/cálculo nem nas server actions.
- Testes Vitest: rodar pelo PowerShell com cwd `C:\Users\LuisVillaca\Documents\ObraApp` (C maiúsculo), senão tudo falha.
- Manual (`lib/ajuda/`), capturas e Novidades atualizados no mesmo PR; Vercel atualizado ao final.

## Review Focus

1. Tocar "ir" com "Corrigir execução" fechado → a seção abre e a página rola até o campo de causa (o elemento dentro de `<details>` fechado não rola). Coberto no e2e `causa-no-fim` (Task 4).
2. Salvamento em andamento dentro de "Corrigir execução" recolhido → o botão do cabeçalho mostra "Salvando…" e fica desabilitado. Teste de componente na Task 3.
3. Turno sem link de campo → "Link de campo" aparece aberto com "Gerar link" visível (e2e `quadro.spec.ts:78` e capturas dependem disso). Task 4.
4. Cancelar a confirmação e tocar "Fechar turno" de novo → volta a mostrar a confirmação/pendências sem recarregar. Teste de componente na Task 3.
5. Turno fechado → "Reabrir turno" logo abaixo do título e RDO aberto; nenhuma área de fechamento. Teste estático na Task 4.

---

### Task 1: "Remover" discreto

**Files:**
- Modify: `components/ui/Botao.tsx` (nova variante)
- Modify: `app/(app)/obras/[obraId]/turnos/[turnoId]/ItemAtividade.tsx:40,159` (tipo da variante do `BotaoAcao`; Remover usa a nova)
- Test: `tests/dominio/botao.test.tsx` (criar)

**Interfaces:**
- Produces: `variante="discreto"` em `Botao`/`classesBotao` — `"bg-transparent text-texto-suave underline hover:text-perigo"` (sem fundo).

- [ ] **Step 1: Teste que falha** — `classesBotao("discreto")` contém `bg-transparent` e `underline` e não contém `bg-perigo`.
- [ ] **Step 2:** `npx vitest run tests/dominio/botao.test.tsx` → FAIL (variante inexistente / tipo).
- [ ] **Step 3:** Adicionar `discreto` ao mapa `estilos` e ao tipo; em `ItemAtividade` aceitar `"discreto"` no `BotaoAcao` e usar no "Remover" (confirmação "Remover esta atividade?" mantida). As setas já têm `rotulo` "Subir"/"Descer" — conferir que vira `aria-label`; se não virar, passar.
- [ ] **Step 4:** Teste passa; `npx tsc --noEmit` sem erros.
- [ ] **Step 5:** Commit `feat(turno): Remover discreto na atividade`.

### Task 2: Componente `Recolhivel`

**Files:**
- Create: `components/ui/Recolhivel.tsx`
- Test: `tests/dominio/recolhivel.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export function Recolhivel(props: {
    titulo: React.ReactNode;
    id?: string;
    abertoInicial?: boolean;          // não controlado
    aberto?: boolean;                 // controlado
    aoMudar?: (aberto: boolean) => void;
    children: React.ReactNode;
  }): JSX.Element
  ```
  Visual igual ao `<details>` de "Editar planejamento" (`rounded-cartao border border-borda bg-superficie p-4`, summary `cursor-pointer text-lg font-semibold text-texto`). Controlado: `open={aberto}` + `onToggle` chama `aoMudar(e.currentTarget.open)`.

- [ ] **Step 1: Testes que falham** — `renderToStaticMarkup(<Recolhivel titulo="RDO">x</Recolhivel>)` não tem atributo `open`; com `abertoInicial` tem `open=""`; o summary contém "RDO".
- [ ] **Step 2:** Rodar → FAIL (módulo inexistente).
- [ ] **Step 3:** Implementar (`"use client"`).
- [ ] **Step 4:** Rodar → PASS.
- [ ] **Step 5:** Commit `feat(ui): Recolhivel`.

### Task 3: `TurnoEmExecucao` — Fechar no cabeçalho, pendências no topo, Corrigir recolhido

**Files:**
- Create: `app/(app)/obras/[obraId]/turnos/[turnoId]/TurnoEmExecucao.tsx`
- Modify: `app/(app)/obras/[obraId]/turnos/[turnoId]/EdicaoExecucao.tsx` (vira só o corpo de correção; estado sobe)
- Modify: `app/(app)/obras/[obraId]/turnos/[turnoId]/AcoesTurno.tsx` (extrair a confirmação)
- Modify: `components/execucao/CausasPendentes.tsx` (nada na API; `aoIr` já existe)
- Test: `tests/dominio/turno-em-execucao.test.tsx`, ajustar `tests/dominio/acoes-turno.test.tsx`

**Interfaces:**
- Consumes: `Recolhivel` (Task 2).
- Produces:
  - `AcoesTurno.tsx`: `export function ConfirmarFechamento(props: { turnoId: string; salvando?: boolean; abertas: Ocorrencia[]; janela: Janela | null; nome: (id: string|null) => string; aoCancelar: () => void })` — o `<form action={fechar}>` de hoje (paradas sem fim, `TEXTO_CONFIRMACAO`, "Confirmar fechamento", "Cancelar", erro). `AcoesTurno` continua existindo só para o caso `fechado` (Reabrir), com a mesma saída de hoje.
  - `TurnoEmExecucao.tsx`:
    ```ts
    export function TurnoEmExecucao(props: EdicaoExecucaoProps & {
      cabecalho: React.ReactNode;      // título + selo + Ver quadro + "?"
      acompanhamento: React.ReactNode; // paradas, O que falta, Resumo
      recolhidos: React.ReactNode;     // Editar planejamento, Link, RDO, Relatos, Problemas, Histórico
    }): JSX.Element
    ```
    Dono de: `useRastreioSalvamento` / `ProvedorSalvamento`, `useExecucaoLocal`, `useOcorrencias`, `cobrado`, `fechando` (área aberta), `corrigirAberto`.
    Ordem renderizada: linha `[cabecalho][Botão "Fechar turno" | "Salvando…"]` → área de fechamento (se `fechando`: `CausasPendentes` com título "Antes de fechar, informe a causa em:" quando há pendentes, senão `ConfirmarFechamento`) → `acompanhamento` → `<Recolhivel titulo="Corrigir execução" aberto={corrigirAberto}>` com o corpo de `EdicaoExecucao` → `recolhidos`.
    Tocar "Fechar turno": `setFechando(true)`; se há pendentes, `setCobrado(true)`. `aoIr` do `CausasPendentes`: `setCobrado(true); setCorrigirAberto(true)` (o `requestAnimationFrame` duplo existente dá conta da rolagem depois de abrir). "Cancelar": `setFechando(false)`.
  - `EdicaoExecucao` passa a receber de cima `lista`, `mudar`, `erros`, `cobrado`, `mov` e `registrar` (ou ser renderizado dentro do provedor e ler do contexto — escolha do implementador), e não renderiza mais `CausasPendentes` nem `AcoesTurno`. Título interno "Corrigir execução" sai (vira o summary).

- [ ] **Step 1: Testes que falham** (`renderToStaticMarkup`, actions mockadas como em `acoes-turno.test.tsx`):
  - `TurnoEmExecucao` sem pendências: o HTML tem botão "Fechar turno" antes do texto do `acompanhamento` e um `<details>` sem `open` cujo summary é "Corrigir execução"; não contém "Confirmar fechamento".
  - `ConfirmarFechamento` renderiza "Confirmar fechamento", "Cancelar" e `TEXTO_CONFIRMACAO`.
  - `AcoesTurno fechado` continua com "Reabrir turno" (teste existente passa sem mudança).
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar conforme Interfaces.
- [ ] **Step 4:** Testes de componente (Review Focus 2 e 4) com `@testing-library/react` se já estiver no projeto (senão, cobrir no e2e da Task 4): com `ocupado` verdadeiro o botão mostra "Salvando…" e está `disabled`; clicar "Fechar turno" → "Cancelar" → "Fechar turno" mostra "Confirmar fechamento" de novo.
- [ ] **Step 5:** `npx vitest run` e `npx tsc --noEmit` → verdes.
- [ ] **Step 6:** Commit `feat(turno): fechar no cabeçalho e corrigir execução recolhido`.

### Task 4: Nova ordem da página, testes de ponta a ponta, manual e Novidades

**Files:**
- Modify: `app/(app)/obras/[obraId]/turnos/[turnoId]/page.tsx`
- Modify: `PainelLink.tsx`, `BlocoRdo.tsx`, `HistoricoTurno.tsx` (aceitar ficar dentro de `Recolhivel`: tirar o `Cartao`/título próprios quando recolhidos, ou envolver por fora — escolha do implementador, sem título duplicado)
- Modify: `tests/e2e/causa-no-fim.spec.ts`, `ciclo-turno.spec.ts`, `servico-extra.spec.ts`, `programacao.spec.ts`, `quadro.spec.ts`, e os que clicam algo de "Corrigir execução" no planejador (abrir o summary antes)
- Modify: `tests/manual/capturas.spec.ts`, `lib/ajuda/conteudo/fechar-turno.ts` (e capítulos do turno que citem posição/rolagem), `lib/ajuda/novidades.ts`
- Test: `tests/dominio/turno-fechado.test.tsx` (ou incluir no e2e `ciclo-turno`)

**Interfaces:**
- Consumes: `Recolhivel`, `TurnoEmExecucao`, `AcoesTurno` (fechado).

Ordem por status (de `page.tsx`):
- **planejado:** como hoje (FaixaParadas não aparece; `PainelLink` aberto; lista + dados); `GerenciarProblemas` e `HistoricoTurno` recolhidos.
- **em_campo / enviado:** `TurnoEmExecucao` com `cabecalho` = linha de título atual; `acompanhamento` = `FaixaParadas`, `OQueFalta`, `Resumo`; `recolhidos` = "Editar planejamento" (já é `<details>`), `Recolhivel "Link de campo"` (`abertoInicial` quando `!link.existe`), `Recolhivel "RDO"`, `RelatosCampo` (já é `<details>`), `GerenciarProblemas` (já é `<details>`), `Recolhivel "Histórico"`. Link "← obra" e "Previsto: …" continuam acima.
- **fechado:** título → `AcoesTurno fechado` → `Resumo` → `Recolhivel "RDO" abertoInicial` → `RelatosCampo`, `GerenciarProblemas`, `Recolhivel "Histórico"`, `Recolhivel "Link de campo"`.

- [ ] **Step 1:** Montar a página conforme acima.
- [ ] **Step 2:** Ajustar os e2e: onde o planejador interage com campos de correção (horário, execução, efetivo, paradas, extra), clicar antes no summary "Corrigir execução". Em `causa-no-fim.spec.ts:69-74`: com a seção fechada, "Fechar turno" → lista de pendências no topo → "Ir para a causa: Montagem de tubulação" → o campo de causa fica visível (`toBeInViewport`) e a seção está aberta (Review Focus 1). Em `ciclo-turno`, após fechar: "Reabrir turno" visível e RDO aberto sem clicar (Review Focus 5). `quadro.spec.ts:78` "Gerar link" continua visível sem clicar (Review Focus 3).
- [ ] **Step 3:** `SUPABASE_TEST=1 npm run test:e2e` → todos verdes (mostrar saída).
- [ ] **Step 4:** Manual: em `fechar-turno.ts` dizer que "Fechar turno" fica no alto da página, ao lado de "Ver quadro"; que, se faltar causa, a lista aparece ali com "ir"; que as correções ficam em "Corrigir execução" (toque para abrir). Revisar outros capítulos com `grep -rn "Corrigir execução\|fim da página\|role" lib/ajuda/conteudo`. Novidades, no topo:
  `{ data: "2026-11-26", texto: "Página do turno mais curta: \"Fechar turno\" fica no alto, ao lado de \"Ver quadro\", e a lista do que falta para fechar aparece ali mesmo. Abre com o que serve para acompanhar (paradas, o que falta, resumo); \"Corrigir execução\", RDO, link de campo e histórico ficam recolhidos. O \"Remover\" da atividade ficou discreto.", href: "/ajuda/fechar-turno" }` (ajustar âncora à seção certa).
- [ ] **Step 5:** Capturas: ajustar `capturas.spec.ts` (abrir "Corrigir execução" antes das fotos de correção) e rodar `SUPABASE_TEST=1 npm run manual:capturas` → verde; conferir as imagens do turno geradas.
- [ ] **Step 6:** `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build` → verdes.
- [ ] **Step 7:** Commit `feat(turno): nova ordem da página, manual e novidades (item 16)`; marcar item 16 como no ar em `docs/backlog.md` ao fazer o merge.
