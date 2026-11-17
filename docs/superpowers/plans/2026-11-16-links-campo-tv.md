# Links de campo e da TV sempre visíveis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o link de campo e o link do quadro (TV) continuam visíveis depois de recarregar, e gerar um link novo do campo pede confirmação.

**Architecture:** duas colunas novas guardam o token em claro (`turnos.token_campo`, `obras.quadro_token`), protegidas pela RLS de membro que já existe. O hash continua sendo a chave de busca das rotas públicas. As páginas do planejador leem o token e passam para `PainelLink`/`LinkQuadro`.

**Tech Stack:** Next 16 (server actions), Supabase (Postgres + RLS), Vitest (integração com `SUPABASE_TEST=1`), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-16-links-campo-tv-design.md`

## Global Constraints
- Sem `localStorage`/`sessionStorage`.
- Termo "Responsável", nunca "encarregado", em textos novos.
- Token em claro nunca entra nas fotos (RDO, check-in, semana), em `CAMPOS` de `lib/db/turnos.ts` (é reaproveitado pelo campo via admin) nem em telas públicas.
- `/t/[token]` e `/q/[codigo]` continuam resolvendo pelo hash; nada muda nelas.
- Arquivos do repo têm CRLF: preservar ao editar.
- Testes pelo PowerShell com `Set-Location 'C:\Users\LuisVillaca\Documents\ObraApp'` (C maiúsculo).
- Migration aplicada em DEV (SQL Editor, guiando o usuário) antes dos testes de integração; em PROD antes do merge.

## Review Focus
1. Link criado antes da migration (hash sem token): tela explica e oferece gerar novo — coberto no teste de componente da Task 2.
2. Turno reaberto (fechado → enviado): o mesmo link volta a aparecer — assert na Task 1.
3. Falha ao gerar novo link: o link ainda válido continua na tela (comportamento atual de `PainelLink`, manter).
4. Cancelar a confirmação não gera link (nenhuma chamada à action) — E2E na Task 3 com `dialog.dismiss()`.
5. Membro de outra empresa não lê `token_campo`/`quadro_token` — assert de RLS na Task 1.

---

### Task 1: Migration e camada de dados

**Files:**
- Create: `supabase/migrations/20261117000000_links_visiveis.sql`
- Modify: `lib/db/turnos.ts` (`aplicarAcao`, `gerarNovoLink`, nova `linkCampo`)
- Modify: `lib/db/quadro.ts` (`gerarLinkQuadro`; `temLinkQuadro` → `linkQuadro`)
- Test: `tests/integracao/link.test.ts`, `tests/integracao/quadro.test.ts`

**Interfaces:**
- Produces:
  - `linkCampo(c: SupabaseClient, turnoId: string): Promise<{ existe: boolean; token: string | null }>`: `existe` = `token_hash` não nulo; `token` = `token_campo`. UUID inválido → `{ existe: false, token: null }`; outro erro → throw (mesmo padrão de `temLinkQuadro`).
  - `linkQuadro(c: SupabaseClient, obraId: string): Promise<{ existe: boolean; codigo: string | null }>`: substitui `temLinkQuadro` (remover a antiga e atualizar `app/(app)/obras/[obraId]/page.tsx`).

- [ ] **Step 1: Migration**: `alter table public.turnos add column token_campo text;` e `alter table public.obras add column quadro_token text;`, com comentário explicando que o hash continua sendo a busca. Sem backfill (impossível). Nenhuma grant nova (anon não tem nada; authenticated já passa pela RLS).
- [ ] **Step 2: Guiar o usuário para aplicar a migration no Supabase DEV** pelo SQL Editor.
- [ ] **Step 3: Testes que falham.** Em `link.test.ts`, no teste existente: depois de liberar, `expect(await linkCampo(u.cliente, t.id)).toEqual({ existe: true, token: r.dados.token })`; depois de `gerarNovoLink`, o token é o novo; depois de reabrir, continua igual a `n2.dados.token` (o gerado no estado enviado). Turno planejado → `{ existe: false, token: null }`. Turno legado: `update({ token_campo: null })` via `u.cliente` → `{ existe: true, token: null }`. RLS: um segundo `criarUsuarioTeste()` lendo `linkCampo(outro.cliente, t.id)` → `{ existe: false, token: null }`. Em `quadro.test.ts`: troca `temLinkQuadro` por `linkQuadro`: antes `{ existe: false, codigo: null }`, depois de gerar `{ existe: true, codigo }`, depois de gerar de novo `codigo: novo`.
- [ ] **Step 4: Rodar e ver falhar**: `$env:SUPABASE_TEST='1'; npx vitest run tests/integracao/link.test.ts tests/integracao/quadro.test.ts` → falha por import inexistente.
- [ ] **Step 5: Implementar**: `aplicarAcao` (liberar) grava `token_campo: token` junto do `token_hash`; `gerarNovoLink` idem; `gerarLinkQuadro` grava `quadro_token: codigo`. Escrever `linkCampo` e `linkQuadro`. Atualizar o comentário de `gerarLinkQuadro`.
- [ ] **Step 6: Rodar de novo** o mesmo comando, mais `tests/integracao/turno-eventos.test.ts` e `tests/integracao/campo.test.ts` → PASS.
- [ ] **Step 7: Commit** `feat(links): guardar link de campo e do quadro para exibir de novo`.

### Task 2: Telas (PainelLink e LinkQuadro)

**Files:**
- Modify: `app/(app)/obras/[obraId]/turnos/[turnoId]/PainelLink.tsx`, `.../turnos/[turnoId]/page.tsx`
- Modify: `app/(app)/obras/[obraId]/LinkQuadro.tsx`, `app/(app)/obras/[obraId]/page.tsx`
- Test: `tests/dominio/links-ui.test.tsx` (novo, `renderToStaticMarkup` + `vi.mock` das actions, como em `acoes-turno.test.tsx`)

**Interfaces:**
- Consumes: `linkCampo`, `linkQuadro` (Task 1).
- Produces:
  - `PainelLink` ganha as props `tokenAtual: string | null` e `linkAntigo: boolean` (= `existe && token === null`). O token exibido é o último devolvido pela action, ou então `tokenAtual`.
  - `LinkQuadro({ obraId, existe, codigoAtual }: { obraId: string; existe: boolean; codigoAtual: string | null })`: o código exibido é o gerado agora, ou então `codigoAtual`.
  - Constantes exportadas (copy exata):
    - `CONFIRMAR_NOVO_LINK_CAMPO = "O link já enviado para as equipes vai parar de funcionar"` (em `PainelLink.tsx`).
    - `CONFIRMAR_NOVO_LINK` (TV) passa a `"O link que está na TV e com o gestor vai parar de funcionar"`.
    - `TEXTO_LINK_ANTIGO = "Este link foi criado antes desta atualização e não pode ser exibido. Gere um novo para vê-lo aqui sempre."` (em `lib/dominio/link.ts`, usada pelos dois cartões).

- [ ] **Step 1: Testes que falham**:
  - `PainelLink` em `em_campo` com `tokenAtual="abc…"` mostra a URL de `urlCampo`, "Copiar link" e "Enviar pelo WhatsApp", e não contém "não será exibido de novo".
  - Com `tokenAtual={null}` e `linkAntigo` mostra `TEXTO_LINK_ANTIGO`.
  - `status="fechado"` → vazio.
  - `LinkQuadro` com `codigoAtual` mostra a URL de `urlQuadro`, "Copiar" e "Abrir".
  - Com `existe` e `codigoAtual={null}` mostra `TEXTO_LINK_ANTIGO`.
  - Sem link mostra o botão "Gerar link".
  - Asserts das duas constantes de confirmação.
- [ ] **Step 2: Rodar e ver falhar**: `npx vitest run tests/dominio/links-ui.test.tsx`.
- [ ] **Step 3: Implementar**:
  - Páginas: buscar `linkCampo`/`linkQuadro` em paralelo com o que já buscam (`.catch` → `{ existe: false, token/codigo: null }` na página do turno; na da obra, mesmo tratamento de hoje).
  - O form "Gerar novo link" do `PainelLink` ganha `onSubmit` com `window.confirm(\`${CONFIRMAR_NOVO_LINK_CAMPO}. Continuar?\`)`; se a pessoa cancelar, chama `preventDefault`.
  - Remover os dois "Guarde este link…" e as frases "Link enviado. Perdeu o link?…" e "Link já gerado. Perdeu o link?…" (o caso legado usa `TEXTO_LINK_ANTIGO`).
- [ ] **Step 4: Rodar** `npx vitest run` (suíte de domínio inteira) e `npx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(links): link de campo e da TV visíveis após recarregar; confirmar novo link`.

### Task 3: E2E

**Files:**
- Modify: `tests/e2e/ciclo-turno.spec.ts`, `tests/e2e/quadro.spec.ts`

- [ ] **Step 1**: em `ciclo-turno.spec.ts`, logo após capturar `urlCampo`: `page.reload()` e esperar `p.break-all` com o mesmo texto. Depois, registrar `page.once("dialog", d => d.dismiss())` antes do `page.on` global, ou usar um listener controlado. Clicar em "Gerar novo link": o texto continua igual. Por fim, aceitar a confirmação: o texto muda, a URL antiga mostra o erro de link inválido do campo e a nova abre. Para controlar o diálogo, troque o `page.on("dialog", accept)` desse spec por um handler que leia uma variável `respostaDialogo`.
- [ ] **Step 2**: em `quadro.spec.ts`, depois de "Gerar link": `page.reload()` e a mesma URL continua em `p.break-all`.
- [ ] **Step 3: Rodar**: `$env:SUPABASE_TEST='1'; npx playwright test tests/e2e/ciclo-turno.spec.ts tests/e2e/quadro.spec.ts` → PASS. Depois a suíte E2E inteira → PASS.
- [ ] **Step 4: Commit** `test(e2e): links sobrevivem ao recarregar e novo link pede confirmação`.

### Fechamento
- [ ] `npx vitest run` (com `SUPABASE_TEST=1`), `npx tsc --noEmit`, `npm run lint`, `npm run build` → sem erros.
- [ ] Revisão final da branch (subagente).
- [ ] Atualizar `docs/backlog.md` (item 5 ✅) e a memória do roadmap.
- [ ] Push da branch (prévia Vercel) → usuário valida → aplicar a migration em PROD → merge `--no-ff` na main → push.
