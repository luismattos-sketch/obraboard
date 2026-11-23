# Clareza do lançamento (item 11) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Campo "Total feito hoje" com "+ Somar", pergunta antes de "✓ Concluída" trocar um parcial, e dica "salva sozinho".

**Architecture:** Contas e textos em funções puras (`lib/dominio/lancamento.ts`); o card (`BlocoAtividades`) usa estado local para o painel de somar e a pergunta, e grava pelo `atualizar` existente (mesmo auto-salvar).

**Tech Stack:** React client, Vitest (`renderToStaticMarkup`), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-22-clareza-lancamento-design.md`

## Global Constraints

- Textos exatos: `Total feito hoje (<unidade>)`, `+ Somar`, `Quanto a mais?`, `Somar`, `Cancelar`, prévia `40 + 30 = 70`, `Trocar 40 por 60?`, `Sim`, `Não`, `salva sozinho`, `Digite um número válido`, `Corrija o total antes de somar`.
- Números em pt-BR (`numeroBR`, vírgula). Botões com `min-h-11` ou maiores (uso com luva).
- Nunca `localStorage`/`sessionStorage`. Sem migration.
- Arquivos do repo têm CRLF: editar com Edit/node, nunca `Get-Content`/`Set-Content`.

## Review Focus

1. Somar enquanto o total está inválido ("abc") → não soma, mostra `Corrija o total antes de somar` (Task 1).
2. Somar com decimais ("2,5" + "0,5") → `3` sem erro de ponto flutuante (Task 1).
3. Pergunta aberta e o valor muda (digitou no campo) → pergunta fecha (Task 2).
4. Somar levando acima da meta → total maior que a meta, status Concluída, sem pergunta (Task 1/2).
5. Extra: `+ Somar` aparece, `✓ Concluída` não (Task 2).

---

### Task 1: Contas do lançamento

**Files:** Create `lib/dominio/lancamento.ts`; Test `tests/dominio/lancamento.test.ts`

**Interfaces (Produces):**
- `somarLancamento(totalTexto: string, maisTexto: string): { ok: true; total: number } | { ok: false; erro: string }` — total vazio = 0; total inválido → `Corrija o total antes de somar`; mais vazio/0/negativo/inválido → `Digite um número válido`; soma arredondada a 3 casas.
- `textoSoma(total: number, mais: number): string` → `"40 + 30 = 70"` (numeroBR).
- `perguntaConcluida(qtd: number | null, meta: number): string | null` → `"Trocar 40 por 60?"` quando `qtd > 0 && qtd < meta`; senão `null`.
- `textoTotal(n: number): string` → valor para o campo (`2,5`).

- [ ] Step 1: testes — `somarLancamento("40","30")` → `{ok:true,total:70}`; `("","5")` → 5; `("2,5","0,5")` → 3; `("0,1","0,2")` → 0.3; `("40","0")`, `("40","-3")`, `("40","")`, `("40","x")` → erro `Digite um número válido`; `("abc","3")` → `Corrija o total antes de somar`. `textoSoma(40,30)` = `"40 + 30 = 70"`; `textoSoma(2.5,0.5)` = `"2,5 + 0,5 = 3"`. `perguntaConcluida(40,60)` = `"Trocar 40 por 60?"`; `(null,60)`, `(0,60)`, `(60,60)`, `(70,60)` → null; `(2.5,4)` = `"Trocar 2,5 por 4?"`. `textoTotal(2.5)` = `"2,5"`.
- [ ] Step 2: `npx vitest run tests/dominio/lancamento.test.ts` → FAIL (módulo não existe).
- [ ] Step 3: implementar.
- [ ] Step 4: mesmo comando → PASS.
- [ ] Step 5: commit `feat(dominio): contas do lançamento (somar e pergunta da concluída)`.

### Task 2: Card

**Files:** Modify `components/execucao/BlocoAtividades.tsx:210-245`, `components/execucao/IndicadorSalvo.tsx`; Test `tests/dominio/card-lancamento.test.tsx`; ajustar `tests/dominio/observacao-concluida.test.tsx` ("Feito (m³)" → "Total feito hoje (m³)").

**Interfaces:** Consumes Task 1. `IndicadorSalvo` ganha `dica?: string` mostrada (text-sm text-texto-suave) quando `estado === "ocioso"` e não há `nota`.

- Rótulo `Total feito hoje (${a.unidade})` para todos os tipos.
- Linha de botões: `+ Somar` (se `!somenteLeitura`), `✓ Concluída` (regra atual). Em tela estreita usar `flex-wrap`.
- `+ Somar` abre painel: input `Quanto a mais?` (inputMode decimal), prévia `textoSoma` quando válido, `Somar` → `somarLancamento`; ok → `atualizar(textoTotal(total), causa, obs)` e fecha; erro → mostra o erro (text-perigo) e não grava. `Cancelar` fecha.
- `✓ Concluída`: se `perguntaConcluida(qtd, a.qtd_planejada)` → mostra no lugar dos botões o texto + `Sim` (grava a meta) e `Não` (fecha). Senão grava a meta direto. Mudar o campo fecha a pergunta.
- Passar `dica="salva sozinho"` ao `IndicadorSalvo` quando `!somenteLeitura`.

- [ ] Step 1: testes (render estático): parcial mostra `Total feito hoje (tubo)`, `+ Somar`, `✓ Concluída`, `salva sozinho`; não contém `Executado`; extra mostra `+ Somar` e não `✓ Concluída`; somente leitura sem `+ Somar` e sem `salva sozinho`; `IndicadorSalvo` ocioso com `dica` mostra a dica e com `nota` mostra só a nota.
- [ ] Step 2: `npx vitest run tests/dominio/card-lancamento.test.tsx` → FAIL.
- [ ] Step 3: implementar.
- [ ] Step 4: `npx vitest run tests/dominio` e `npx tsc --noEmit` → PASS.
- [ ] Step 5: commit `feat(execucao): total feito hoje, somar e pergunta antes da concluída`.

### Task 3: E2E

**Files:** `/Executado/` → `/Total feito hoje/` em `tests/e2e/*.spec.ts` e `tests/manual/capturas.spec.ts`; Create `tests/e2e/clareza-lancamento.spec.ts`.

- [ ] Step 1: novo spec (padrão do `causa-no-fim.spec.ts`, celular): digita 40 de 60 → `Salvo ✓`; `+ Somar`, `Quanto a mais?` 30 → vê `40 + 30 = 70`, `Somar` → campo `70`… (meta 60: usar meta 100 para ficar parcial) — usar meta 100: 40 + 30 = 70, campo `70`, `Salvo ✓`; `✓ Concluída` → `Trocar 70 por 100?`; `Não` → campo continua `70`; `✓ Concluída` → `Sim` → campo `100`, selo `Concluída`, `Salvo ✓`; recarregar → `100`.
- [ ] Step 2: `$env:SUPABASE_TEST='1'; npx playwright test --project="Desktop Chrome"` → todos ok.
- [ ] Step 3: commit `test(e2e): somar e pergunta da concluída`.

### Task 4: Manual, capturas, Novidades

**Files:** `lib/ajuda/conteudo/campo.ts:26-31` (texto e `alvo` → `{ papel: "textbox", nome: "Total feito hoje" }`), `fechar-turno.ts`, `duvidas.ts` se citar "Executado", `lib/ajuda/novidades.ts`.

- [ ] Step 1: textos — campo: "Em cada atividade, \"Total feito hoje\" é tudo o que a equipe fez no dia. Fez mais um trecho? Toque em \"+ Somar\" e digite só o que fez agora. Terminou tudo? Toque em \"✓ Concluída\" (se já houver um número, o app pergunta antes de trocar). Tudo salva sozinho."; Novidade `{ data: "2026-11-22", texto: "Lançamento mais claro: \"Total feito hoje\", botão \"+ Somar\" e pergunta antes de trocar um parcial pela meta.", href: "/ajuda/campo#lancar" }` (conferir o id da seção).
- [ ] Step 2: `npx vitest run tests/dominio/ajuda-*` → PASS; capturas `campo` e `fechar-turno` → PASS.
- [ ] Step 3: commit `docs(ajuda): total feito hoje e somar`.

### Task 5: Fechamento

- [ ] vitest completo com `SUPABASE_TEST=1`, `tsc`, `lint`, `build` → verde; revisão final (subagente opus); push da branch → prévia; merge `--no-ff` após o ok do Luis.
