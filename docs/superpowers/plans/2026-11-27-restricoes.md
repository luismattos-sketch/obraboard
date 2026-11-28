# 5.2 Restrições Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Restrições (tipo, descrição, responsável, prazo, Aberta/Removida) em cada item do lookahead.
**Architecture:** Tabela `restricoes` ligada a `cronograma_itens`; regras puras em `lib/dominio/restricoes.ts` (mesmo molde de `lib/dominio/problemas.ts`); camada `lib/db/restricoes.ts`; UI no `ItemLookahead`.
**Spec:** `docs/superpowers/specs/2026-11-27-restricoes-design.md`

## Global Constraints
- Migration `20261207000000_restricoes.sql`; produção só com OK do Luis.
- Sem localStorage; "responsável", nunca "encarregado".
- Testes no PowerShell, cwd `C:\…`; integração com `SUPABASE_TEST=1`.

## Review Focus
- Restrição vencida: aberta com prazo < hoje (SP) → selo "N vencidas"; removida nunca vence (Task 1).
- Item removido do cronograma mantém restrições (cascade só no delete do item) (Task 2).
- Apagar item manual apaga as restrições (cascade) (Task 2).
- Responsável vazio ou só espaços → recusado (Task 1).

### Task 1: Regras puras
**Files:** Create `lib/dominio/restricoes.ts`; Test `tests/dominio/restricoes.test.ts`
**Produces:**
```ts
export type Restricao = { id: string; cronograma_item_id: string; tipo: Causa; descricao: string; responsavel: string; prazo: string | null; removida_em: string | null; created_at: string };
export type DadosRestricao = { tipo: string; descricao: string; responsavel: string; prazo?: string | null };
export function validarRestricao(d: DadosRestricao): { ok: true; dados: {tipo: Causa; descricao: string; responsavel: string; prazo: string | null} } | { ok: false; erro: string; campos: Record<string, string> };
export const restricaoVencida: (r: Pick<Restricao, "prazo" | "removida_em">, hoje: string) => boolean;
export function resumoRestricoes(lista: Pick<Restricao,"prazo"|"removida_em">[], hoje: string): { abertas: number; vencidas: number };
export function ordenarRestricoes<T extends Pick<Restricao,"prazo"|"removida_em"|"created_at">>(l: T[]): T[]; // abertas antes; prazo asc (sem prazo por último); created_at
```
Limites: descrição 1–300, responsável 1–100, tipo ∈ `CAUSAS`, prazo ISO ou vazio.
- [ ] Testes (validação, vencida, resumo, ordem) → FAIL → implementar → PASS → commit.

### Task 2: Migration + banco
**Files:** Create `supabase/migrations/20261207000000_restricoes.sql`, `lib/db/restricoes.ts`; Test `tests/integracao/restricoes.test.ts`
SQL: tabela conforme spec, `check (tipo in (...causas))`, RLS `for all` via `cronograma_itens → obras → eh_membro`.
**Produces:** `listarRestricoesDaObra(c, obraId): Promise<Map<string, Restricao[]>>` (por item), `salvarRestricao(c, itemId, d: DadosRestricao, id?): Promise<Resultado<Restricao>>`, `marcarRemovida(c, id, removida: boolean): Promise<Resultado>`, `apagarRestricao(c, id): Promise<Resultado>`.
- [ ] Teste: cria, edita, remove/reabre, RLS de outro usuário, item removido do cronograma mantém restrição, apagar item manual apaga restrições → FAIL → migration em dev + implementar → PASS → commit.

### Task 3: UI no Lookahead
**Files:** Create `app/(app)/obras/[obraId]/lookahead/Restricoes.tsx`; Modify `.../lookahead/page.tsx` (carrega o mapa + sugestões de responsáveis via `listarResponsaveis`), `ItemLookahead.tsx` (selo + `Restricoes`), `.../lookahead/acoes.ts` (`salvarRestricaoAcao`, `marcarRemovidaAcao`, `apagarRestricaoAcao`).
Copy: selo `N restrição(ões) aberta(s)` (alerta) / `N vencida(s)` (perigo); botão `Restrições (N)`; `Adicionar restrição`; campos `Tipo`, `Descrição`, `Responsável`, `Prazo (opcional)`; ações `Removida`, `Reabrir`, `Editar`, `Apagar`; removidas em "Removidas (N)" recolhido.
- [ ] e2e `tests/e2e/lookahead.spec.ts` ganha trecho: adicionar restrição com prazo passado → selo "1 vencida"; "Removida" → selo some → PASS. tsc/eslint → commit.

### Task 4: Manual e entrega
- [ ] Passo `restricoes` em `lib/ajuda/conteudo/programar-semana.ts` (após `lookahead`), captura em `tests/manual/capturas.spec.ts` (criar 1 restrição no item 3.1.1 antes de fotografar), Novidades; `MANUAL_CAPITULO=programar-semana npm run manual:capturas`; `npm test` + build → commit.
- [ ] Revisão final; OK do Luis → migration prod, merge, deploy, planilha 5.2, memória.
