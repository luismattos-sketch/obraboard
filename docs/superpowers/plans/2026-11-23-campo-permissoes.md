# Item 10 — Permissões no campo: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Passos com checkbox.

**Goal:** no link de campo, cada responsável só edita o que é dele; horário/clima/envio ficam com o planejador;
planejador vê quem alterou por último.

**Architecture:** regras no servidor (lib/db/campo.ts, terminados.ts) recusam o que o campo não pode; UI do campo
fica só leitura onde preciso; migration pequena para "última alteração".

**Tech Stack:** Next.js (app router), Supabase (Postgres + RPC), vitest, Playwright.

**Spec:** docs/superpowers/specs/2026-11-23-campo-permissoes-design.md

## Global Constraints
- Sem localStorage/sessionStorage; escolha do responsável só na URL (?r=, ?ok=1).
- Termo "Responsável", nunca "encarregado", em texto visível.
- Testes pelo PowerShell com `Set-Location 'C:\Users\LuisVillaca\Documents\ObraApp'`; integração/E2E com `SUPABASE_TEST=1`.
- Arquivos do repo têm CRLF: editar com Edit ou node, nunca Get-Content/Set-Content.
- Migration aplicada em DEV e PROD pelo SQL Editor (dizer o projeto em destaque).
- Após `npx playwright test` completo: `git checkout -- public/ajuda` (exceto ao gerar capturas de propósito).

## Review Focus
1. Atividade sem responsável (responsavel_id nulo) no turno: envio automático NÃO acontece (planejador fecha).
2. Terminei repetido (23505) ainda tenta o envio automático (o 1º pode ter falhado depois do insert).
3. Desfazer com turno `enviado` volta a `em_campo`; com turno `fechado` continua recusado (ERRO_FECHADO_CAMPO).
4. ?r=<id> de responsável que não está no turno continua caindo em "Quem é você?" (não confirma nome inválido).
5. Planejador salvando efetivo/atividade marca autor "planejador"; registro antigo sem `lancado_em` não mostra selo.

---

### Task 1: Migration "última alteração"

**Files:** Create `supabase/migrations/20261124000000_ultima_alteracao.sql`; Modify `lib/db/atividades.ts` (tipo, colunas, mapeamento), `lib/db/execucao.ts`, `lib/db/campo.ts`, selects de efetivo em `lib/db/turnos.ts`; Test `tests/integracao/execucao.test.ts`.

**Interfaces — Produces:**
- `atividades.lancado_em timestamptz null`; `Atividade.lancado_em: string | null`.
- `efetivo.lancado_pelo_planejador boolean not null default false` (hora = `created_at`, recriado a cada salvamento); selects de efetivo passam a trazer `created_at, lancado_pelo_planejador`.
- RPC `substituir_efetivo(p_turno_id uuid, p_responsavel_id uuid, p_esperado jsonb, p_linhas jsonb, p_pelo_planejador boolean default false)`: dropar a de 4 args, recriar com 5, mesmos revokes/grants; insert grava `lancado_pelo_planejador`.

- [ ] Teste: `salvarExecucaoPlanejador` grava `lancado_em` não nulo e `lancado_por_id` nulo; efetivo salvo pelo planejador → linhas com `lancado_pelo_planejador = true`; pelo campo → false.
- [ ] Rodar (falha) → escrever migration → aplicar em DEV → `salvarExecucaoPlanejador` grava `lancado_por_id: null, lancado_em: new Date().toISOString()`; `lib/db/execucao.ts` (rpc) passa `p_pelo_planejador: true`; `salvarExecucao` do campo grava `lancado_em` também.
- [ ] `SUPABASE_TEST=1 npx vitest run tests/integracao/execucao.test.ts tests/integracao/campo.test.ts` → PASS. Commit.

### Task 2: Servidor do campo recusa o que não é do responsável

**Files:** Modify `lib/db/campo.ts`, `app/t/[token]/acoes.ts`; Test `tests/integracao/campo.test.ts`.

**Interfaces — Produces:** `salvarExecucao(token, atividadeId, dados, esperado, responsavelId: string)` e `salvarEfetivo(token, linhas, esperado, responsavelId: string)` — sem default; nulo/vazio → `falha(ERRO_RESPONSAVEL_INVALIDO)`. Remover do campo (`campo.ts` e `acoes.ts`): `salvarClima`, `removerClima`, `salvarHorarioReal`, `enviarTurnoCampo`. Idem `removerOcorrencia`/`encerrarParada`/`enviarFotoParada` com responsável nulo → recusa (conferir assinaturas atuais).

- [ ] Testes: execução com `null` → ERRO_RESPONSAVEL_INVALIDO; efetivo com `null` → idem; ajustar/remover testes antigos que usavam "Ver tudo" ou clima/horário/envio pelo campo.
- [ ] Rodar (falha) → implementar → `tests/integracao/campo.test.ts` PASS; `npx tsc --noEmit` limpo. Commit.

### Task 3: Envio automático quando todos terminam

**Files:** Modify `lib/db/terminados.ts`; Test `tests/integracao/terminados.test.ts`.

**Interfaces — Produces:** `sincronizarEnvio(admin, turnoId): Promise<void>` (interna): lê `responsavel_id` das atividades do turno e as `turno_equipes_terminadas`; se nenhuma atividade tem responsável nulo, há ≥1 responsável, todos terminaram e status = `em_campo` → `aplicarAcao(admin, turnoId, "enviar")`. Chamada no fim de `marcarTerminouCampo` (também no 23505). Em `desfazerTerminouCampo`, após o delete: `update turnos set status='em_campo', enviado_em=null where id=? and status='enviado'`. Falha no envio só loga (Terminei continua ok).

- [ ] Testes: 2 responsáveis — 1º termina → `em_campo`; 2º → `enviado`; desfazer → `em_campo`; atividade sem responsável → nunca envia; repetir Terminei após envio → ok e `enviado`.
- [ ] Rodar (falha) → implementar → PASS (se gatilho bloquear enviado→em_campo, ajustar na migration da Task 1). Commit.

### Task 4: Tela do campo — confirmação e só leitura

**Files:** Modify `app/t/[token]/page.tsx`, `app/t/[token]/FormularioCampo.tsx`, `app/t/[token]/EscolhaResponsavel.tsx` (+ `ConfirmarResponsavel` no mesmo arquivo); Create `tests/e2e/campo-permissoes.spec.ts`; ajustar E2E/componentes existentes que usavam "Enviar turno" no campo ou editavam em "Ver tudo".

**Interfaces — Consumes:** Task 2.

- [ ] E2E: `?r=<ana>` → "Você é a Ana?" com "Sou eu" / "Não, voltar", sem campos editáveis; "Sou eu" → `?r=<ana>&ok=1` editável; "Trocar" → `?`; `?r=todos` → nenhum campo editável, sem "Enviar turno"; horário e clima como texto ("—" se vazio); último a tocar Terminei → planejador vê "Enviado".
- [ ] Implementar: page.tsx mostra confirmação quando `r` é válido e `ok !== "1"`; links internos preservam `ok=1`; FormularioCampo: `responsavelId === null` → tudo `somenteLeitura`; BlocoClima sempre `somenteLeitura` no campo; horário como linha "Início real: hh:mm · Fim real: hh:mm"; remover bloco/handlers de "Enviar turno".
- [ ] E2E novo + `npx vitest run` → PASS. Commit.

### Task 5: Selo "quem alterou" no planejador

**Files:** Create `lib/dominio/ultimaAlteracao.ts`; Modify `app/(app)/obras/[obraId]/turnos/[turnoId]/EdicaoExecucao.tsx` e o bloco de efetivo do planejador; Test `tests/dominio/ultimaAlteracao.test.ts`.

**Interfaces — Produces:**
- `ultimaAlteracao(a: { lancado_por_id: string | null; lancado_em: string | null }, nome: (id: string) => string): string | null` → null se `lancado_em` nulo; `"você · 10:05"` se `lancado_por_id` nulo; `"Ana · 09:12"` caso contrário (hh:mm no fuso SP).
- `ultimaAlteracaoEfetivo(linhas: { lancado_pelo_planejador: boolean; created_at: string }[], nomeEquipe: string): string | null` → mais recente; null sem linhas.

- [ ] Testes dos três casos + fuso (`2026-11-23T12:12:00Z` → "09:12").
- [ ] Implementar e exibir no card (junto do autor existente) e no cabeçalho do efetivo de cada equipe. `npx vitest run` → PASS. Commit.

### Task 6: Manual, capturas, fluxograma, Novidades, backlog

**Files:** `lib/ajuda/` (capítulos de campo e turno), `lib/ajuda/fluxograma.ts`, `lib/ajuda/novidades.ts`, `docs/backlog.md`.

- [ ] Textos: sem "Enviar turno" no campo (envio pelo Terminei de todos), confirmação de nome, horário/clima com o planejador, selo de quem alterou.
- [ ] `SUPABASE_TEST=1 npm run manual:capturas` → PASS; `npx vitest run` e `SUPABASE_TEST=1 npx playwright test` → PASS; regerar capturas se a suíte as sobrescrever. Commit.
