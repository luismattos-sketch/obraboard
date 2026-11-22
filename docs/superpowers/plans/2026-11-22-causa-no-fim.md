# Causa só na hora certa (item 8) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar o vermelho de causa durante o dia, encurtar o card e cobrar a causa no "Terminei minha parte", no "Enviar turno" e no "Fechar turno".

**Architecture:** O card (`BlocoAtividades`) passa a esconder causa/observação atrás de links e só abre/mostra erro quando recebe `erros` — e as telas só passam `erros` depois de uma cobrança (`cobrado`). Uma lista compartilhada (`CausasPendentes`) mostra o que falta com botão "ir". O servidor recusa o "Terminei" com causa faltando.

**Tech Stack:** Next.js (app router, server actions), React client components, Supabase, Vitest (`renderToStaticMarkup`, sem testing-library), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-22-causa-no-fim-design.md`

## Global Constraints

- Nunca `localStorage`/`sessionStorage`.
- Termo "Responsável", nunca "encarregado".
- Textos exatos: link `Não vai dar para concluir? Informar causa`; link `+ Observação`; títulos `Antes de terminar, informe a causa em:`, `Antes de enviar, informe a causa em:`, `Antes de fechar, informe a causa em:`; erro do servidor `Informe a causa das atividades não concluídas antes de terminar.`; rótulos existentes `Causa do não cumprimento` e `Observação` não mudam.
- Lista e erro do card em tom `alerta` (amarelo), nunca `perigo`.
- Sem migration. Causa continua salva só pelo caminho do card (`useAutoSalvar` / `salvar`).
- Testes pelo PowerShell com `Set-Location 'C:\Users\LuisVillaca\Documents\ObraApp'` (C maiúsculo). Integração/E2E com `SUPABASE_TEST=1`.

## Review Focus

1. Causa escolhida e "Terminei" tocado antes do "Salvo ✓": o servidor ainda não vê a causa → o botão fica "Salvando…" e desabilitado enquanto `ocupado` (Task 2).
2. "Outro" sem observação na cobrança: o card abre também a Observação, não só a causa (Task 1).
3. Atividade que vira concluída depois da cobrança some da lista e o card fecha a causa sem apagar observação (Task 1/2).
4. Equipe com só extra/adiantada não concluídas: "Terminei" registra direto (Task 3 teste de servidor).
5. Outra equipe com causa faltando não bloqueia o "Terminei" desta (Task 3).

---

### Task 1: Card curto, abre na cobrança

**Files:**
- Modify: `components/execucao/BlocoAtividades.tsx:121-268`
- Create: `lib/dominio/cardCausa.ts`
- Test: `tests/dominio/card-causa.test.tsx` (novo); ajustar `tests/dominio/observacao-concluida.test.tsx` se quebrar

**Interfaces:**
- Produces: `camposAbertos(p: { naoConcluida: boolean; causa: string; obs: string; erro?: string; abriuCausa: boolean; abriuObs: boolean }): { causa: boolean; obs: boolean }` em `lib/dominio/cardCausa.ts`.
  Regra: `causa = naoConcluida && (abriuCausa || !!causa || !!erro)`; `obs = abriuObs || !!obs.trim() || (!!erro && causa === "outro")`.
- Card: `erro` presente ⇒ campos abrem e a mensagem aparece em `text-alerta-escura` (`text-alerta` puro não tem contraste sobre branco). Sem `erro` ⇒ nada vermelho.
- Links (botões `type="button"`, sublinhados, `text-sm text-texto-suave`) só quando `!somenteLeitura` e o campo está fechado: `Não vai dar para concluir? Informar causa` (só se `naoConcluida`) e `+ Observação`. Clicar marca `abriuCausa`/`abriuObs` (estado local, fica aberto).
- Somente leitura: mostra causa/observação só se tiverem valor.

- [ ] **Step 1: Testes que falham** (`tests/dominio/card-causa.test.tsx`)
  - `camposAbertos`: vazio parcial → `{causa:false, obs:false}`; com `erro` → `{causa:true, obs:false}`; `erro` + `causa:"outro"` → obs true; `obs:" x "` → obs true; concluída com erro → causa false; `abriuCausa` → causa true.
  - Render (`renderToStaticMarkup`) de atividade parcial (`qtd_realizada: 3`, plan 8, sem causa/obs): contém `Não vai dar para concluir? Informar causa` e `+ Observação`; não contém `Causa do não cumprimento` nem `>Observação<`.
  - Mesma atividade com `erros={{a1:"Informe a causa para atividades não concluídas"}}`: contém `Causa do não cumprimento` e o texto do erro; não contém `text-perigo`.
  - Com `causa: "material"`: contém `Causa do não cumprimento` sem precisar de erro.
- [ ] **Step 2:** `npx vitest run tests/dominio/card-causa.test.tsx` → FAIL.
- [ ] **Step 3:** Implementar `camposAbertos` e usar no `ItemExecucao`.
- [ ] **Step 4:** `npx vitest run tests/dominio` → PASS (corrigir `observacao-concluida` só se a expectativa antiga for a do comportamento retirado).
- [ ] **Step 5:** Commit `feat(execucao): card curto, causa e observação atrás de links`.

### Task 2: Cobrança nas telas (Terminei, Enviar, Fechar)

**Files:**
- Create: `components/execucao/CausasPendentes.tsx`
- Modify: `components/execucao/BotaoTerminei.tsx`, `app/t/[token]/FormularioCampo.tsx:179-305`, `app/(app)/obras/[obraId]/turnos/[turnoId]/EdicaoExecucao.tsx:90-226`, `app/(app)/obras/[obraId]/turnos/[turnoId]/AcoesTurno.tsx`
- Test: `tests/dominio/causas-pendentes.test.tsx` (novo), `tests/dominio/acoes-turno.test.tsx`

**Interfaces:**
- Consumes: `errosDeCausa` (`lib/dominio/regras.ts`), `numeroBR`.
- Produces:
  - `linhaPendente(a: AtividadeExec): string` → `"Montagem (3 de 8 tubo)"`; executado nulo vale `0` (`"Solda (0 de 4 un)"`).
  - `CausasPendentes({ titulo: string; pendentes: AtividadeExec[] })`: `Aviso tom="alerta"`, título em `font-medium`, uma linha por pendente com `linhaPendente` + botão `ir` (`aria-label={\`Ir para a causa: ${a.descricao}\`}`) que faz `document.getElementById(\`causa-${a.id}\`)` → `scrollIntoView({ block: "center" })` + `focus()`. Não renderiza nada com lista vazia.
  - `BotaoTerminei` ganha `bloqueado?: boolean` e `aoBloquear?: () => void`: com `bloqueado`, o clique chama `aoBloquear` e não marca; com `salvando` (já existe) o botão inicial fica desabilitado com texto `Salvando…`.
  - `AcoesTurno` ganha `aoBloquear?: () => boolean`: no clique de "Fechar turno", se retornar `true` não abre a confirmação.
- Telas: estado `cobrado` (`useState(false)`).
  - **Campo com responsável:** `bloqueado = pendentes.length > 0`; `aoBloquear = () => setCobrado(true)`; `salvando` do BotaoTerminei = `salvandoTerminei || salvando` (rastreio). Acima do botão: `cobrado && <CausasPendentes titulo="Antes de terminar, informe a causa em:" …/>`.
  - **Campo "Ver tudo":** "Enviar turno" deixa de ser `disabled` por pendência; clique com pendência → `setCobrado(true)` e não envia. A caixa atual vira `cobrado && <CausasPendentes titulo="Antes de enviar, informe a causa em:" …/>`.
  - **Planejador:** caixa atual vira `<CausasPendentes titulo="Antes de fechar, informe a causa em:" …/>` sempre visível quando há pendência; `AcoesTurno aoBloquear={() => { if (!pendentes.length) return false; setCobrado(true); return true; }}`.
  - Nas três: `BlocoAtividades erros={cobrado ? erros : {}}`.

- [ ] **Step 1: Testes que falham**
  - `linhaPendente({descricao:"Montagem", qtd_planejada:8, qtd_realizada:3, unidade:"tubo"…})` → `"Montagem (3 de 8 tubo)"`; `qtd_realizada:null`, plan 4, `un` → `"Solda (0 de 4 un)"`; `2,5` formatado com vírgula.
  - `CausasPendentes` com 2 pendentes: contém o título, as duas linhas e `aria-label="Ir para a causa: Montagem"`; com `[]` → `""`.
  - `BotaoTerminei` com `salvando` e sem `terminouEm`: botão `disabled` com `Salvando…`.
- [ ] **Step 2:** `npx vitest run tests/dominio/causas-pendentes.test.tsx tests/dominio/acoes-turno.test.tsx` → FAIL.
- [ ] **Step 3:** Implementar componentes e ligar nas três telas.
- [ ] **Step 4:** `npx vitest run` e `npx tsc --noEmit` → PASS.
- [ ] **Step 5:** Commit `feat(execucao): causa cobrada no Terminei, Enviar e Fechar`.

### Task 3: Servidor recusa "Terminei" sem causa

**Files:**
- Modify: `lib/db/terminados.ts:21-30`, `lib/db/mensagens.ts`
- Test: `tests/integracao/terminados.test.ts`

**Interfaces:**
- Produces: `ERRO_CAUSA_TERMINEI = "Informe a causa das atividades não concluídas antes de terminar."` em `lib/db/mensagens.ts`.
- `marcarTerminouCampo`: depois de `turnoAberto`, ler `atividades` (`id, qtd_planejada, qtd_realizada, causa, observacao, tipo`) com `turno_id = t.dados.id` e `responsavel_id = responsavelId` pelo cliente admin; se `errosDeCausa` tiver chave → `falha(ERRO_CAUSA_TERMINEI)`. Repetição de término já gravado continua sucesso (checar causa antes do insert é ok: término gravado implica causas já dadas).

- [ ] **Step 1: Testes que falham** (no `cenario`, atribuir a atividade à Ana: `responsavel_id: r.id`)
  - Atividade da Ana `qtd_realizada: 0`, sem causa → `{ ok:false, erro: ERRO_CAUSA_TERMINEI }` e `terminados` vazio.
  - Mesma com causa `"outro"` sem observação → recusa; com observação → ok.
  - Concluída (1 de 1) → ok (o teste existente "marcar, repetir…" passa a concluir antes).
  - Atividade sem causa de **outra** equipe (responsável "João") não bloqueia a Ana.
  - Atividade `tipo: "extra"` da Ana não concluída não bloqueia (inserir via cliente com `tipo` e `qtd_planejada = qtd_realizada`, ou `adiantada` com `qtd_realizada: null`).
- [ ] **Step 2:** `$env:SUPABASE_TEST='1'; npx vitest run tests/integracao/terminados.test.ts` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Mesmo comando → PASS.
- [ ] **Step 5:** Commit `feat(campo): servidor recusa Terminei com causa faltando`.

### Task 4: E2E

**Files:**
- Modify: `tests/e2e/ciclo-turno.spec.ts:116-121`, `tests/e2e/programacao.spec.ts:88`, `tests/e2e/aviso-parada.spec.ts:101`
- Create: `tests/e2e/causa-no-fim.spec.ts`

- [ ] **Step 1:** Ajustar specs: antes de `getByLabel("Causa do não cumprimento")` clicar `getByRole("button", { name: "Não vai dar para concluir? Informar causa" })`; antes de `getByLabel("Observação")` sem texto, clicar `+ Observação`. Em `aviso-parada`, se a atividade da Ana não estiver concluída, informar a causa antes do "Terminei".
- [ ] **Step 2:** Novo spec (padrão de `preparar.ts`; abrir a página do planejador antes do celular; pré-aquecer rotas com `page.request.get`):
  - Celular da Ana, atividade parcial (3 de 8): nenhum texto `Informe a causa` visível e sem combobox de causa.
  - Toca `✓ Terminei minha parte` → aparece `Antes de terminar, informe a causa em:` com `(3 de 8`; sem `Você avisou que terminou`; combobox `Causa do não cumprimento` visível no card.
  - Botão `Ir para a causa: …` foca o combobox (`toBeFocused`).
  - Escolhe `Falta material`, espera `Salvo ✓`, toca Terminei → `Você avisou que terminou às`.
  - Planejador: `Fechar turno` com atividade sem causa não abre `Confirmar fechamento`; card mostra a causa aberta.
- [ ] **Step 3:** `$env:SUPABASE_TEST='1'; npx playwright test` → PASS (matar `next dev` antigo na porta 3000 se houver build recente).
- [ ] **Step 4:** Commit `test(e2e): causa cobrada no fim`.

### Task 5: Manual, capturas e Novidades

**Files:**
- Modify: `lib/ajuda/conteudo/campo.ts:73-74`, `lib/ajuda/conteudo/fechar-turno.ts:23-31`, `lib/ajuda/novidades.ts`, `tests/manual/capturas.spec.ts:191-200`, conferir `lib/ajuda/fluxograma.ts`

- [ ] **Step 1:** Textos:
  - campo (Terminei): "Terminou a sua parte? Toque em \"✓ Terminei minha parte\". Se alguma atividade não chegou ao previsto, o app pede antes a causa (toque em \"ir\" para chegar ao campo). O planejador vê no quadro, e você pode avisar também pelo WhatsApp."
  - campo (Ver tudo): trocar o fim por "…precisa da \"Causa do não cumprimento\"; o app lista o que falta ao tocar em \"Enviar turno\"."
  - fechar-turno (causas): incluir "Abra o campo em \"Não vai dar para concluir? Informar causa\"" e trocar `"Falta informar a causa em:"` por `"Antes de fechar, informe a causa em:"`.
  - Novidades (topo): `{ data: "2026-11-22", texto: "A causa só é pedida no fim: ao tocar \"Terminei minha parte\", enviar ou fechar o turno.", href: "/ajuda/fechar-turno#causas" }`.
  - Fluxograma: só mudar se houver passo "Terminei"; acrescentar "informar causa do que faltou" antes dele.
- [ ] **Step 2:** Capturas: na de `fechar-turno`, clicar todos os `Não vai dar para concluir? Informar causa` antes de pegar os combobox; no celular, se houver pendência, informar causa antes do Terminei.
- [ ] **Step 3:** `npx vitest run tests/dominio/ajuda-*` → PASS; `$env:SUPABASE_TEST='1'; $env:MANUAL_CAPITULO='campo'; npm run manual:capturas` e de novo com `fechar-turno` → PASS, imagens atualizadas em `public/ajuda`.
- [ ] **Step 4:** Commit `docs(ajuda): causa no fim, capturas e novidade`.

### Task 6: Fechamento

- [ ] `npx vitest run`, `$env:SUPABASE_TEST='1'; npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build` → tudo verde.
- [ ] Revisão final do branch (subagente).
- [ ] `git push -u origin causa-no-fim` → prévia na Vercel para o Luis validar; merge `--no-ff` na `main` + push depois do ok.
