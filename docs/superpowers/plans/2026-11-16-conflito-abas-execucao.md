# Conflito entre abas na execução — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nenhuma gravação da execução sobrescreve um valor que a tela não viu; conflito aparece com texto claro e botão "Ver valor atual" (execução e efetivo); aba que volta a ficar visível se atualiza.

**Architecture:** Checagem otimista no UPDATE da atividade (filtros com os valores `esperado`), igual em princípio ao `substituir_efetivo`. A falha de conflito carrega os valores atuais; a tela guarda o `esperado` por atividade, salva em série e, no conflito, o `Sincronizar` remonta o bloco com os dados do servidor e mostra uma nota com o que foi digitado.

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, Supabase (PostgREST), Vitest, Playwright.

**Spec:** [docs/superpowers/specs/2026-11-16-conflito-abas-execucao-design.md](../specs/2026-11-16-conflito-abas-execucao-design.md)

## Global Constraints
- Nunca usar `localStorage`/`sessionStorage`; o banco (Supabase) é a fonte oficial.
- Textos da interface em pt-BR; nunca "encarregado" em texto visível (usar "responsável").
- Texto do conflito da execução começa com: `Mudou em outra tela (pode ter sido você em outra aba).`
- Texto do conflito do efetivo: `O efetivo mudou em outra tela (pode ter sido você em outra aba).`
- Botão: `Ver valor atual`. Nota depois de carregar: `Você tinha digitado …`.
- Não oferecer "Manter o meu"; depois de um conflito nada regrava sozinho.
- Sem migração de banco.
- Antes de usar API do Next (ex.: `useRouter().refresh()`), conferir `node_modules/next/dist/docs/`.
- Ao fim: deploy no Vercel.

## Review Focus
1. Atividade nova (quantidade, causa e observação nulas): o primeiro salvamento não pode dar conflito — filtro precisa ser `is null`, não `eq`. (Task 2, teste "esperado nulo".)
2. Atividade concluída: o banco grava causa/observação nulas mesmo se a tela mandou texto; o próximo salvamento usa o valor devolvido pelo servidor e não dá conflito falso. (Task 2, teste "concluída".)
3. Observação com espaços (" x "): banco grava "x"; o esperado devolvido é "x". (Task 2, teste no planejador.)
4. Quantidade decimal (2,5): comparação numérica do `numeric` com número JS precisa bater. (Task 2, teste "decimal".)
5. Duas edições rápidas na mesma aba (digita 8 e logo escolhe a causa): não pode dar conflito falso — salvamento em série. (Task 4, E2E existente continua passando + passo novo.)

---

### Task 1: Textos e tipo do conflito

**Files:**
- Create: `lib/dominio/conflito.ts`
- Modify: `lib/db/resultado.ts`, `lib/db/mensagens.ts`
- Test: `tests/dominio/conflito.test.ts`

**Interfaces:**
- Produces:
  - `type ValoresExecucao = { qtd_realizada: number | null; causa: Causa | null; observacao: string | null }` (em `lib/dominio/conflito.ts`)
  - `PREFIXO_CONFLITO = "Mudou em outra tela (pode ter sido você em outra aba)."`
  - `textoConflitoExecucao(atual: ValoresExecucao, digitado: ValoresExecucao, unidade: string): string`
  - `notaDigitadoExecucao(digitado: ValoresExecucao): string`
  - `notaDigitadoEfetivo(linhas: { funcao: string; quantidade: number }[]): string`
  - `Resultado` falha ganha `conflito?: { atual?: unknown }`; helper `falhaConflito(erro: string, atual?: unknown): Resultado<never>`
  - `ERRO_EFETIVO_CONFLITO` passa a ser o texto do efetivo acima; novo `ERRO_EXECUCAO_CONFLITO = PREFIXO_CONFLITO`.

- [ ] **Step 1: Testes** em `tests/dominio/conflito.test.ts`:
```ts
const v = (q: number | null, c: Causa | null = null, o: string | null = null) => ({ qtd_realizada: q, causa: c, observacao: o });
expect(textoConflitoExecucao(v(46), v(47), "m")).toBe("Mudou em outra tela (pode ter sido você em outra aba). Agora está 46 m, você tinha digitado 47.");
expect(textoConflitoExecucao(v(2.5), v(null), "m²")).toBe("Mudou em outra tela (pode ter sido você em outra aba). Agora está 2,5 m², você tinha deixado em branco.");
expect(textoConflitoExecucao(v(5, "material"), v(5, "clima"), "un")).toBe("Mudou em outra tela (pode ter sido você em outra aba). Agora a causa é Material, você tinha escolhido Clima.");
expect(textoConflitoExecucao(v(5, null, "a"), v(5, null, "b"), "un")).toBe("Mudou em outra tela (pode ter sido você em outra aba). A observação também foi alterada.");
// várias diferenças: frases na ordem quantidade, causa, observação, separadas por espaço
expect(notaDigitadoExecucao(v(47, "clima"))).toBe("Você tinha digitado 47 (causa: Clima).");
expect(notaDigitadoExecucao(v(null, null, "obs"))).toBe("Você tinha digitado: observação \"obs\".");
expect(notaDigitadoEfetivo([{ funcao: "Pedreiro", quantidade: 7 }, { funcao: "Servente", quantidade: 2 }])).toBe("Você tinha digitado: Pedreiro 7, Servente 2.");
expect(notaDigitadoEfetivo([])).toBe("Você tinha deixado o efetivo vazio.");
```
Rótulos de causa vêm de `CAUSAS` (`lib/dominio/tipos`), número com `numeroBR`. Use os rótulos reais de `CAUSAS` nos testes (ajuste "Material"/"Clima" se divergirem). Para a quantidade nula em `atual`: "Agora está em branco".
- [ ] **Step 2:** `npx vitest run tests/dominio/conflito.test.ts` → FAIL (módulo inexistente).
- [ ] **Step 3:** Implementar `lib/dominio/conflito.ts`, `falhaConflito` e as mensagens. Ajustar `tests/dominio/invariantes.test.ts` se algo comparar o texto antigo.
- [ ] **Step 4:** `npx vitest run tests/dominio` → PASS.
- [ ] **Step 5:** Commit `feat(conflito): textos e tipo de falha de conflito`.

### Task 2: Checagem otimista no servidor (campo e planejador)

**Files:**
- Modify: `lib/db/execucao.ts`, `lib/db/campo.ts`, `app/t/[token]/acoes.ts`, `app/(app)/obras/[obraId]/turnos/[turnoId]/acoesExecucao.ts`
- Test: `tests/integracao/campo.test.ts`, `tests/integracao/execucao.test.ts`

**Interfaces:**
- Consumes: `ValoresExecucao`, `falhaConflito`, `ERRO_EXECUCAO_CONFLITO` (Task 1).
- Produces:
  - `salvarExecucao(token, atividadeId, dados: DadosExecucao, esperado: ValoresExecucao, responsavelId: string | null = null): Promise<Resultado<ValoresExecucao>>` (campo.ts e a action em `app/t/[token]/acoes.ts`, mesma ordem)
  - `salvarExecucaoPlanejador(c, turnoId, atividadeId, dados, esperado: ValoresExecucao): Promise<Resultado<ValoresExecucao>>`; action `corrigirExecucao(turnoId, atividadeId, dados, esperado)`
  - Sucesso: `dados` = valores como gravados (`camposExecucao` + `qtd_realizada`). Conflito: `{ ok:false, erro: ERRO_EXECUCAO_CONFLITO, conflito: { atual: ValoresExecucao } }` com `qtd_realizada` como `number`.
  - `comRevalidacao` vira genérico `<T>`.

- [ ] **Step 1: Testes de integração.** Atualizar as chamadas existentes passando o `esperado` encadeado (o `dados` do resultado anterior; inicial `{qtd_realizada:null,causa:null,observacao:null}`). Novos casos em `campo.test.ts` (novo `it`, turno próprio via `turnoLiberado`):
  - "esperado nulo": 1º salvamento de atividade nova com esperado nulo → `ok:true`, `dados` = `{qtd_realizada:3,causa:"material",observacao:null}`.
  - "roteiro da Rita": aba A grava 46 (esperado da A); aba B com esperado velho (45) grava só observação → `ok:false`, `erro` começa com `Mudou em outra tela`, `conflito.atual.qtd_realizada === 46`; banco continua 46 e sem a observação de B.
  - "concluída": salvar qtd = planejada com obs "x" → `dados.observacao === null`; salvar de novo com esse `dados` como esperado → `ok:true`.
  - "decimal": gravar 2.5, depois salvar com esperado `qtd_realizada: 2.5` → `ok:true`.
  - Equipe errada (`responsavelId` de outro) continua `{ ok:false, erro: FORA }` mesmo com esperado divergente.
  - Esperado inválido (`qtd_realizada: -1`) → `ok:false`.
  Em `execucao.test.ts`: " x " → `dados.observacao === "x"`; esperado velho → conflito com `atual`.
- [ ] **Step 2:** `npx vitest run tests/integracao/campo.test.ts tests/integracao/execucao.test.ts` (com `SUPABASE_TEST=1` / `.env.local` como nos testes atuais) → FAIL.
- [ ] **Step 3: Implementar.** Helper exportado em `lib/db/execucao.ts`, reaproveitado em `campo.ts`:
  `filtrarEsperado<Q>(q: Q, e: ValoresExecucao): Q` — para cada coluna, `.is(col, null)` se nulo, senão `.eq(col, valor)`.
  Validar `esperado` com `validarExecucao`. Com 0 linhas gravadas: reler `qtd_realizada, causa, observacao, responsavel_id` da atividade no turno; inexistente ou de outra equipe → erro atual de "não encontrada"; senão `falhaConflito(ERRO_EXECUCAO_CONFLITO, atual)`.
- [ ] **Step 4:** Rodar os testes do Step 2 → PASS. `npx tsc --noEmit` só pode acusar `FormularioCampo.tsx` e `EdicaoExecucao.tsx` (chamadores do cliente, ligados na Task 3).
- [ ] **Step 5:** Commit `feat(execucao): checagem otimista ao salvar a execução` (a Task 3 fecha o build; não fazer deploy entre as duas).

### Task 3: Tela — esperado por atividade, aviso e "Ver valor atual"

**Files:**
- Modify: `components/execucao/BlocoAtividades.tsx`, `components/execucao/BlocoEfetivo.tsx`, `components/execucao/useAutoSalvar.ts`, `components/execucao/IndicadorSalvo.tsx`, `components/execucao/Sincronizar.tsx`, `app/t/[token]/FormularioCampo.tsx`, `app/(app)/obras/[obraId]/turnos/[turnoId]/EdicaoExecucao.tsx`, `lib/db/campo.ts` e `lib/db/execucao.ts` (efetivo devolve `falhaConflito(ERRO_EFETIVO_CONFLITO)`)
- Test: `tests/dominio/indicador-salvo.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces:
  - Prop `salvar` de `BlocoAtividades`: `(atividadeId: string, dados: DadosExecucao, esperado: ValoresExecucao) => Promise<Resultado<ValoresExecucao>>`.
  - `EstadoSalvar` ganha `conflito?: { atual?: unknown }` (preenchido quando a falha traz `conflito`).
  - `IndicadorSalvo` ganha `onVerAtual?: () => void`; com `estado:"erro"` e `conflito`, mostra a mensagem (tom alerta) e o botão `Ver valor atual`.
  - Contexto `Sincronia` ganha `recarregar(nota: string): void` e `nota: string | null`.

- [ ] **Step 1: Teste** `tests/dominio/indicador-salvo.test.tsx` (renderToStaticMarkup): com `{estado:"erro", mensagem:"Mudou em outra tela…", conflito:{}}` e `onVerAtual` → HTML contém `Mudou em outra tela` e `Ver valor atual`; sem `conflito` → não contém `Ver valor atual`.
- [ ] **Step 2:** `npx vitest run tests/dominio/indicador-salvo.test.tsx` → FAIL.
- [ ] **Step 3: Implementar.**
  - `ItemExecucao`: `esperado` em `useRef` iniciado com os valores do servidor; salvamento via `criarFila` (como `BlocoEfetivo`); sucesso → `esperado.current = r.dados`; conflito → mensagem `textoConflitoExecucao(r.conflito.atual, digitado, a.unidade)` (substitui a mensagem do estado ao renderizar). "Ver valor atual" → `sincronia.recarregar(notaDigitadoExecucao(digitado))`. A nota do contexto aparece abaixo do card (texto suave) até a próxima edição.
  - `BlocoEfetivo`: mesma coisa com `notaDigitadoEfetivo(validas)`.
  - `Sincronizar.recarregar(nota)`: guarda a nota, `setSujo(false)`, incrementa `geracao` (remonta com as props atuais) e chama `router.refresh()`; quando as props novas chegam, a regra existente remonta de novo. `sujo(true)` (nova edição) limpa a nota.
  - Chamadores (`FormularioCampo`, `EdicaoExecucao`) repassam `esperado` às actions.
- [ ] **Step 4:** `npx vitest run` e `npx tsc --noEmit` e `npm run lint` → tudo PASS.
- [ ] **Step 5:** Commit `feat(execucao): aviso de conflito com "Ver valor atual"`.

### Task 4: Atualizar ao voltar para a aba + E2E

**Files:**
- Create: `components/execucao/useAtualizarAoVoltar.ts`
- Modify: `app/t/[token]/FormularioCampo.tsx`, `app/(app)/obras/[obraId]/turnos/[turnoId]/EdicaoExecucao.tsx`, `tests/e2e/ciclo-turno.spec.ts`

**Interfaces:**
- Produces: `useAtualizarAoVoltar(ocupado: boolean): void` — em `visibilitychange` para `visible`, chama `router.refresh()` se `!ocupado` (lido por ref, sem re-registrar o listener).

- [ ] **Step 1: E2E** em `ciclo-turno.spec.ts`, no bloco do campo: abrir `campo2 = await ctx.newPage()` no mesmo `urlCampo` **antes** de lançar as atividades. Depois que o card 2 da `campo` mostrar "Salvo ✓" (8, Material), em `campo2` preencher a Observação do card 2 com "aba velha" e esperar `getByText(/Mudou em outra tela/)` e `getByText(/Agora está 8/)`; clicar `Ver valor atual`; esperar o campo Executado de `campo2` com valor `8` e `getByText(/Você tinha digitado/)`. Fechar `campo2`. O resto do fluxo continua igual (o "8 + Material" logo em seguida na mesma aba prova que não há conflito falso).
- [ ] **Step 2:** `SUPABASE_TEST=1 npx playwright test tests/e2e/ciclo-turno.spec.ts` → FAIL (antes do hook só falha se o conflito não aparecer; se a Task 3 já está feita, deve passar a parte do conflito — ok).
- [ ] **Step 3:** Implementar o hook e usá-lo nos dois formulários com o `ocupado` de `useRastreioSalvamento`.
- [ ] **Step 4:** Rodar todos os E2E (`SUPABASE_TEST=1 npx playwright test`) + `npx vitest run` → PASS. Conferência manual do "voltar para a aba" (duas abas reais, trocar de aba) registrada no resumo final.
- [ ] **Step 5:** Commit `feat(execucao): atualiza a tela ao voltar para a aba`; atualizar `docs/backlog.md` marcando o item 1 como feito.
