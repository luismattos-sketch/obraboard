# Registros incompletos (10.4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bloco "O que falta" na página do turno, por responsável, com "Cobrar no WhatsApp".

**Architecture:** Função pura `faltasDoTurno` (lib/dominio/faltas.ts) recebe turno, atividades, relatos, terminados
e "agora"; a página (server) monta os dados e passa a um componente cliente `OQueFalta`. Mensagem em
`mensagemCobranca` (lib/dominio/whatsapp.ts). Sem migration.

**Tech Stack:** Next.js (app router), TypeScript, Vitest + Testing Library, Playwright (capturas do manual).

**Spec:** docs/superpowers/specs/2026-11-23-registros-incompletos-design.md

## Global Constraints

- Nunca `localStorage`/`sessionStorage`.
- Termo "Responsável" (nunca "encarregado"); não usar "pleito".
- Fuso America/Sao_Paulo (`hojeSaoPaulo`, `horaAgoraSaoPaulo` de lib/dominio/entrada.ts).
- Testes pelo PowerShell com `Set-Location 'C:\Users\LuisVillaca\Documents\ObraApp'`.
- Regravar arquivos com node, nunca Get-Content/Set-Content (acentos/BOM). Arquivos do repo têm CRLF.
- Manual (`lib/ajuda/`), capturas do capítulo e linha em Novidades no mesmo PR.

## Review Focus

- Turno noturno que vira o dia (fim 05:00 < início 19:00): hora de cobrar só depois das 05:00 do dia seguinte.
- Atividade sem responsável (`responsavel_id` nulo): grupo "Sem responsável", sem botão de cobrar.
- Extra (planejado = executado, sem causa) nunca vira falta.
- Telefone vazio ou inválido: wa.me sem número, nunca link quebrado.
- Relato lançado e depois outro não lançado do mesmo responsável: conta só o não lançado.

---

### Task 1: Faltas do turno (domínio)

**Files:**
- Create: `lib/dominio/faltas.ts`
- Test: `tests/dominio/faltas.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Falta = { tipo: "sem_lancamento" | "sem_causa" | "relato" | "terminei"; atividadeId: string | null; texto: string };
  export type GrupoFaltas = { responsavelId: string | null; horaDeCobrar: boolean; faltas: Falta[] };
  export function fimDoTurno(t: { data: string; hora_inicio_prevista; hora_fim_prevista; hora_inicio_real; hora_fim_real }): string | null; // "YYYY-MM-DD HH:MM"
  export function faltasDoTurno(p: {
    turno: { status: StatusTurno; data; hora_* (4 campos) };
    atividades: Pick<Atividade, "id"|"descricao"|"unidade"|"qtd_planejada"|"qtd_realizada"|"causa"|"observacao"|"tipo"|"responsavel_id">[];
    relatos: Pick<Relato, "responsavel_id"|"lancado">[];
    terminados: Terminado[];
    agora: Date;
  }): GrupoFaltas[];
  ```
- Regras (do spec): grupos = responsáveis com atividades no turno (+ `null` = "Sem responsável"), na ordem da 1ª
  atividade; só status `em_campo`/`enviado` (outros → `[]`). `sem_lancamento`: `qtd_realizada === null` e
  `tipo !== "extra"`, texto `"<descricao> — lançar quanto foi feito"`. `sem_causa`: só se `horaDeCobrar` e
  `errosDeCausa` acusa; texto `"<descricao> — informar a causa (<feito> de <plan> <unidade>)"` (formato de
  `linhaPendente`); atividade sem lançamento mostra só `sem_lancamento`, mesmo na hora de cobrar (lançar e
  informar a causa se resolvem no mesmo card). `relato`: algum relato
  `lancado=false` do responsável → uma falta `"Texto contado à IA ainda não lançado"`. `terminei`: `horaDeCobrar`,
  status `em_campo`, responsável não nulo sem registro em `terminados` → `"Não apertou \"Terminei minha parte\""`.
  `horaDeCobrar` = está em `terminados` || status `enviado` || (`fimDoTurno` não nulo e agora SP ≥ fim).
  `fimDoTurno`: janela real completa, senão prevista (`janelaDoTurno`); se `fim <= inicio` soma 1 dia à data.

- [ ] **Step 1: Testes que falham** — `faltas.test.ts` com casos:
  - em andamento (agora 10:00, fim 17:00): parcial sem causa → só nada; sem lançamento → `sem_lancamento`; `horaDeCobrar` false.
  - depois do fim (17:01): parcial sem causa → `sem_causa`; responsável sem Terminei → `terminei`.
  - noturno 19:00–05:00 de 2026-11-23: agora 2026-11-23 23:00 → false; 2026-11-24 05:00 → true. `fimDoTurno` = "2026-11-24 05:00".
  - terminou (em `terminados`) às 14:00 com agora 14:30 → `horaDeCobrar` true, sem falta `terminei`.
  - `enviado` → `horaDeCobrar` true, nunca `terminei`.
  - extra sem causa e sem lançamento → nenhuma falta. Adiantada parcial sem causa → nenhuma `sem_causa`.
  - "outro" sem observação na hora de cobrar → `sem_causa`.
  - relatos: [lançado, não lançado] → 1 falta `relato`; só lançados → nenhuma.
  - `responsavel_id` nulo → grupo `responsavelId: null`, sem falta `terminei`.
  - status `planejado`/`fechado` → `[]`. Sem horário de fim → `horaDeCobrar` só por Terminei/enviado.
  - Datas `agora` como `new Date("2026-11-23T20:01:00Z")` (= 17:01 SP).
- [ ] **Step 2:** `npx vitest run tests/dominio/faltas.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar em `lib/dominio/faltas.ts` reaproveitando `errosDeCausa`, `janelaDoTurno`, `hojeSaoPaulo`, `horaAgoraSaoPaulo`, `numeroBR`.
- [ ] **Step 4:** Mesmo comando → PASS.
- [ ] **Step 5:** Commit `feat(faltas): registros incompletos do turno por responsável`.

### Task 2: Mensagem de cobrança

**Files:**
- Modify: `lib/dominio/whatsapp.ts`
- Test: `tests/dominio/whatsapp.test.ts` (existente; acrescentar)

**Interfaces:**
- Consumes: `Falta` (Task 1).
- Produces: `export function mensagemCobranca(p: { obra: string; data: string; periodo: Periodo; nome: string; faltas: Falta[]; link: string | null }): string`
- Texto exato: linha 1 `Oi, <nome>! Falta completar no Frentia — <obra> · dd/mm <Diurno|Noturno>:`; uma linha
  `• <texto da falta>` por falta (trocar o " — " do texto por ": "); última `Abra aqui: <link>` só se `link`.

- [ ] **Step 1:** Teste `mensagemCobranca` com 2 faltas e link → string exata de 4 linhas; sem link → 3 linhas.
- [ ] **Step 2:** `npx vitest run tests/dominio/whatsapp.test.ts` → FAIL.
- [ ] **Step 3:** Implementar (usa `onde()` existente).
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(whatsapp): mensagem de cobrança do responsável`.

### Task 3: Bloco "O que falta" na página do turno

**Files:**
- Create: `app/(app)/obras/[obraId]/turnos/[turnoId]/OQueFalta.tsx` (client)
- Modify: `app/(app)/obras/[obraId]/turnos/[turnoId]/page.tsx` (acima de `<Resumo>`, só `em_campo`/`enviado`)
- Test: `tests/dominio/o-que-falta.test.tsx`

**Interfaces:**
- Consumes: `faltasDoTurno`, `mensagemCobranca`, `linkWhatsapp`, `normalizarWhatsapp`, `urlCampo`.
- Props: `{ grupos: GrupoFaltas[]; responsaveis: { id; nome; telefone: string | null }[]; contexto: { obra; data; periodo }; token: string | null; fim: string | null }`.
- Página calcula `grupos` no servidor com `agora = new Date()`; `listarResponsaveis` já traz `telefone`.

UI (texto do spec): título "O que falta"; sem faltas em nenhum grupo → "Nada faltando ✓". Grupo sem faltas não
aparece. Cabeçalho do grupo: nome (ou "Sem responsável") + "— em andamento" (tom neutro) ou
"— já devia ter fechado (fim HH:MM)" / "— terminou" / "— turno enviado" (tom alerta). Cada falta com
`atividadeId` tem botão "ir" (`aria-label="Ir para: <descricao>"`) que abre o `<details>` da edição de execução,
se fechado, e rola/foca `qtd-<id>`. Botão "Cobrar no WhatsApp" (link `<a target="_blank">`) só para responsável
não nulo; `href = linkWhatsapp(normalizado|null, mensagemCobranca({... link: token ? urlCampo(token)+"?r="+id : null }))`.
Sem telefone: dica "Cadastre o telefone em Responsáveis da obra para abrir direto na conversa."; sem token: dica
"Gere o link de campo para mandar junto.".

- [ ] **Step 1:** Testes: sem faltas → "Nada faltando ✓"; grupo com telefone `(11) 98888-7777` → href começa com
  `https://wa.me/5511988887777?text=` e decodificado contém `?r=<id>`; sem telefone → href `https://wa.me/?text=` + dica;
  grupo `null` → sem botão de cobrar; grupo em alerta mostra "já devia ter fechado (fim 17:00)".
- [ ] **Step 2:** `npx vitest run tests/dominio/o-que-falta.test.tsx` → FAIL.
- [ ] **Step 3:** Implementar componente e ligar na página (conferir o id/`<details>` usado em `EdicaoExecucao`).
- [ ] **Step 4:** PASS; `npx tsc --noEmit` sem erros.
- [ ] **Step 5:** Commit `feat(turno): bloco O que falta com cobrança no WhatsApp`.

### Task 4: Manual, capturas, Novidades e verificação

**Files:**
- Modify: capítulo de acompanhamento do turno em `lib/ajuda/conteudo/` (passo novo "Ver o que falta e cobrar",
  com `alvo` no título "O que falta"), `lib/ajuda/novidades.ts` (linha de 2026-11-23).
- Gerar: `MANUAL_CAPITULO=<capitulo> SUPABASE_TEST=1 npm run manual:capturas`.

- [ ] **Step 1:** Escrever passo + Novidades; `npx vitest run tests/dominio/ajuda-*` → PASS.
- [ ] **Step 2:** Rodar capturas do capítulo → imagem nova em `public/ajuda`.
- [ ] **Step 3:** `npx vitest run` completo e `SUPABASE_TEST=1 npx playwright test` → tudo verde.
- [ ] **Step 4:** Commit `docs(ajuda): o que falta no turno`.
- [ ] **Step 5:** Revisão final por subagente; branch `registros-incompletos`, push (prévia Vercel).
