# Efetivo pré-preenchido Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Atividade do turno tem responsável + equipe; o efetivo de cada equipe aparece já com o previsto (confirmar ou ajustar), com −/+, mais acima no link de campo, e a equipe prevista aparece nas atividades e no quadro.

**Architecture:** Tabela nova `atividade_equipe` para avulsas/extras; programadas leem `programacao_efetivo` pelo `programacao_atividade_id`. Função pura `equipePrevista` soma por responsável. `BlocoEfetivo` mostra o previsto só na tela enquanto não há efetivo gravado; grava ao confirmar/ajustar.

**Tech Stack:** Next.js (ler `node_modules/next/dist/docs/` antes de mexer em rotas/actions), Supabase, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-23-efetivo-pre-preenchido-design.md`

## Global Constraints

- Nunca `localStorage`/`sessionStorage`.
- Texto da tela: "Responsável" (nunca "encarregado"); etiqueta do previsto: "Previsto pela programação — confirme ou ajuste"; botão "Confirmar equipe".
- Validação da equipe igual à da programação: função obrigatória, `FUNCAO_MAX`, quantidade inteira 1..`QTD_PESSOAS_MAX`.
- Previsto nunca grava sozinho; HH/RDO/ocorrências usam só o efetivo gravado.
- Manual (`lib/ajuda/`), capturas e Novidades no mesmo PR; Vercel atualizado no fim.

## Review Focus

1. Equipe com efetivo já gravado (mesmo de outra versão da tela): o previsto não aparece nem sobrescreve — teste em Task 4.
2. Mesma função escrita diferente ("soldador" / "Soldador ") em duas atividades: soma numa linha só — teste em Task 1.
3. Atividade sem responsável com equipe: soma na equipe "Sem responsável" (chave `null`) — teste em Task 1.
4. Turno fechado: inserir em `atividade_equipe` é recusado pelo banco — teste em Task 2.
5. Responsável do link de campo lança extra com equipe: equipe gravada na atividade dele, não em outra — teste em Task 2.

---

### Task 1: Validação e soma da equipe (domínio)

**Files:**
- Modify: `lib/dominio/programacao.ts` (extrair a validação da equipe de `lib/db/programacao.ts:268-273`)
- Create: `lib/dominio/equipePrevista.ts`
- Test: `tests/dominio/equipe-prevista.test.ts`

**Interfaces:**
- Produces: `validarEquipe(bruta: unknown): { equipe: EquipePrevista[]; erro: string | null }` em `lib/dominio/programacao.ts` (usada por `validarAtividadeProgramada` sem mudar mensagens).
- Produces: `equipePrevista(atividades: { responsavel_id: string | null; equipe: EquipePrevista[] }[]): Map<string | null, EquipePrevista[]>` — junta por `normalizarFuncao`, mantém a grafia da primeira ocorrência, ordem de primeira aparição; responsável sem equipe não entra no mapa.

- [ ] **Step 1:** Testes: `equipePrevista` soma `[{r1,[2 Soldador]},{r1,[1 soldador ]},{r1,[1 Ajudante]}]` → `r1: [3 Soldador, 1 Ajudante]`; `null` vira chave própria; atividade com `equipe: []` não cria chave; `validarEquipe([{funcao:"",quantidade:1}]).erro === "Informe a função de cada linha da equipe"`; `validarEquipe(undefined).equipe` é `[]`.
- [ ] **Step 2:** `npx vitest run tests/dominio/equipe-prevista.test.ts` → FAIL.
- [ ] **Step 3:** Implementar; trocar o trecho em `lib/db/programacao.ts` por `validarEquipe`.
- [ ] **Step 4:** `npx vitest run tests/dominio` → PASS (inclui testes da programação existentes).
- [ ] **Step 5:** Commit `feat(equipe): soma da equipe prevista por responsável`.

### Task 2: Banco e gravação

**Files:**
- Create: `supabase/migrations/20261123000000_atividade_equipe.sql`
- Modify: `lib/db/atividades.ts` (`Atividade`, `COLUNAS`, `normalizarAtividade`, `adicionarAtividade`), `lib/db/foraDoDia.ts` (inserção do extra), `lib/dominio/foraDoDia.ts` (`DadosExtra.equipe`, `validarExtra`), `lib/db/turnos.ts:129`, `lib/db/quadro.ts:25`
- Test: `tests/integracao/atividade-equipe.test.ts`, `tests/dominio/fora-do-dia.test.ts`

**Interfaces:**
- Consumes: `validarEquipe` (Task 1).
- Produces: `Atividade.equipe: EquipePrevista[]` — da `atividade_equipe` própria; se vazia e houver `programacao_atividade_id`, da `programacao_efetivo`. Mesmo campo nas atividades do turno completo (`lib/db/turnos.ts`) e do quadro.
- Produces: `adicionarAtividade(c, turnoId, dados: { descricao; local?; unidade; qtd_planejada; responsavel_id: string; equipe: EquipePrevista[] })` — `responsavel_id` obrigatório ("Escolha o responsável").
- Produces: `DadosExtra.equipe: EquipePrevista[]` (opcional na entrada, `[]` se ausente).

Migração: tabela `atividade_equipe (id uuid pk default gen_random_uuid(), atividade_id uuid not null references atividades on delete cascade, funcao text not null, quantidade integer not null check (quantidade > 0), created_at timestamptz default now())`, índice em `atividade_id`, RLS/policy/grants espelhando `efetivo` (via atividade → turno → obra → `eh_membro`), gatilho de turno fechado igual a `efetivo_bloquear_fechado` (seguir `20261109000000_frentia_invariantes.sql`). Gravação da equipe junto com a atividade: inserir a atividade e as linhas; se as linhas falharem, apagar a atividade e devolver erro.

- [ ] **Step 1:** Testes de integração (`SUPABASE_TEST=1`): adicionar com equipe → leitura do turno traz `equipe`; atividade programada sem linha própria traz equipe da programação; inserir equipe em turno fechado falha; extra do campo com `responsavelId` grava equipe na atividade desse responsável. Teste de domínio: `validarExtra` com equipe inválida devolve o erro de `validarEquipe`.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Migração + código. Aplicar a migração no Supabase de teste (`npx supabase db push` no projeto de teste, como nas migrações anteriores).
- [ ] **Step 4:** `SUPABASE_TEST=1 npx vitest run tests/integracao/atividade-equipe.test.ts tests/integracao/fora-do-dia.test.ts` e `npx vitest run` → PASS.
- [ ] **Step 5:** Commit `feat(equipe): equipe na atividade do turno e no extra`.

### Task 3: Formulários com Responsável e Equipe

**Files:**
- Create: `components/execucao/EditorEquipe.tsx` (extraído das linhas de equipe de `FormAtividadeProgramada.tsx:42-144`, que passa a usá-lo)
- Modify: `app/(app)/obras/[obraId]/turnos/[turnoId]/FormAtividade.tsx`, `.../acoes.ts` (`adicionarAtividadeAcao` lê `responsavel_id` e `equipe` em JSON), `components/execucao/ForaDoDia.tsx` (extra ganha `EditorEquipe`)
- Test: `tests/dominio/form-atividade.test.tsx`, `tests/dominio/fora-do-dia-ui.test.tsx`

**Interfaces:**
- Consumes: Task 2 assinaturas.
- Produces: `<EditorEquipe nome="equipe" opcoes={string[]} inicial={EquipePrevista[]} erro?={string} />` — serializa num `<input type="hidden" name="equipe">` com JSON.
- `FormAtividade` recebe `responsaveis: ResponsavelRef[]` e `obraId`; usa `MenuResponsavel` (rótulo "Responsável"); só no modo adicionar.

- [ ] **Step 1:** Testes: enviar sem responsável mostra "Escolha o responsável"; com responsável e "2 Soldador" a action recebe `equipe` `[{funcao:"Soldador",quantidade:2}]`; extra do campo envia `equipe`. Programação continua passando nos testes existentes.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npx vitest run` → PASS.
- [ ] **Step 5:** Commit `feat(turno): responsável e equipe ao adicionar atividade`.

### Task 4: Efetivo com previsto, −/+ e posição

**Files:**
- Modify: `components/execucao/BlocoEfetivo.tsx`, `components/execucao/EfetivoPorEquipe.tsx`, `app/t/[token]/FormularioCampo.tsx` (mover `<EfetivoPorEquipe>` para logo depois de `BlocoHorario`/intervalo), `app/(app)/obras/[obraId]/turnos/[turnoId]/EfetivoTurno.tsx` e `page.tsx` (passar previsto)
- Test: `tests/dominio/efetivo-equipe.test.tsx`

**Interfaces:**
- Consumes: `equipePrevista` (Task 1), `Atividade.equipe` (Task 2).
- `BlocoEfetivo` ganha `previsto?: EquipePrevista[]`: se `inicial` vazio e `previsto` não vazio, as linhas começam com o previsto, mostra a etiqueta e o botão "Confirmar equipe"; nada é salvo até confirmar ou editar (o autosalvar não dispara só por montar). Cada quantidade ganha botões "−" e "+" (aria-label "Diminuir"/"Aumentar", mínimo 1, alvo ≥ 48 px).
- `EfetivoPorEquipe` ganha `previsto?: Map<string | null, EquipePrevista[]>`; equipes com previsto entram em `chaves`.

- [ ] **Step 1:** Testes: com `inicial=[]` e previsto `[2 Soldador]` mostra a etiqueta e `salvar` não é chamado; clicar "Confirmar equipe" chama `salvar([{Soldador,2}], [])`; clicar "+" com previsto grava `3`; com `inicial` não vazio a etiqueta não aparece e o previsto é ignorado; "−" em 1 não desce de 1.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npx vitest run` → PASS.
- [ ] **Step 5:** Commit `feat(efetivo): começa com a equipe prevista, −/+ e mais acima no campo`.

### Task 5: Equipe prevista nas atividades e no quadro

**Files:**
- Modify: `app/(app)/obras/[obraId]/turnos/[turnoId]/ListaAtividades.tsx`, o card de atividade do link de campo (`BlocoAtividades` em `components/execucao/`), o card do quadro (`lib/dominio/quadro.ts` + componente do quadro)
- Test: testes existentes de lista/quadro (`tests/dominio/quadro*.test.ts*`, `card-lancamento.test.tsx`)

**Interfaces:**
- Consumes: `Atividade.equipe`, `resumoEquipe` de `lib/dominio/programacao.ts:128` (texto "2 Soldador + 1 Ajudante"; sem equipe, não mostrar nada nas telas do turno).

- [ ] **Step 1:** Testes: atividade com equipe mostra "Equipe prevista: 2 Soldador + 1 Ajudante" no turno, no campo e no card do quadro; sem equipe, o texto não aparece.
- [ ] **Step 2–4:** FAIL → implementar → `npx vitest run` PASS.
- [ ] **Step 5:** Commit `feat(quadro): equipe prevista nas atividades`.

### Task 6: Manual, e2e e entrega

**Files:**
- Modify: `lib/ajuda/conteudo/check-in.ts`, `campo.ts`, `durante-o-turno.ts`, `lib/ajuda/novidades.ts`; `docs/backlog.md` (item 9 no ar após o merge)
- Create: `tests/e2e/efetivo-previsto.spec.ts`

- [ ] **Step 1:** e2e: programar atividade com "2 Soldador" para Ana → abrir link de campo de Ana → efetivo mostra previsto e etiqueta → "Confirmar equipe" → recarregar → efetivo gravado 2 Soldador sem etiqueta.
- [ ] **Step 2:** Manual + Novidades (uma linha: "O efetivo já vem com a equipe prevista: confirme ou ajuste com − e +.").
- [ ] **Step 3:** `npx vitest run`, `npm run test:e2e -- efetivo-previsto`, `npx tsc --noEmit`, `npm run lint` → tudo verde; `SUPABASE_TEST=1 MANUAL_CAPITULO=campo npm run manual:capturas` (e `check-in`, `durante-o-turno`).
- [ ] **Step 4:** Commit `docs(ajuda): efetivo previsto`; merge em main, aplicar migração em produção, conferir deploy na Vercel.
