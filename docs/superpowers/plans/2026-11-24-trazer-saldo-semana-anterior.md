# Trazer saldo da semana anterior (item 1.6) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No rascunho da semana N, listar o que ficou com saldo na semana N−1 e trazer cada item já preenchido (meta = saldo); avisar e permitir "Atualizar meta" se o saldo da origem mudar depois.

**Architecture:** Duas colunas novas em `programacao_atividades` (`trazida_de`, `saldo_trazido`) com trigger que valida a origem (semana anterior da mesma obra) e índice único por semana. A regra de saldo fica no domínio (`lib/dominio/trazerSaldo.ts`), em cima de `resumirSemana` + `agruparSequencias`. A tela da semana carrega o resumo de N−1 e passa pendentes/saldos aos componentes. A trava da semana programada ganha uma exceção estreita para o "Atualizar meta".

**Tech Stack:** Next.js (App Router, server actions), Supabase/Postgres (migrations, triggers, RPC), Vitest (domínio + integração com `SUPABASE_TEST=1`), Playwright (capturas do manual).

**Spec:** `docs/superpowers/specs/2026-11-24-trazer-saldo-semana-anterior-design.md`

## Global Constraints

- Sem `localStorage`/`sessionStorage`; Supabase é a fonte oficial.
- No texto do app: "Responsável" (nunca "encarregado"); não usar "pleito"; tom neutro.
- Semana anterior = a da mesma obra com `inicio` = segunda − 7 dias; só conta se status ≠ `rascunho`.
- Saldo = o de `resumirSemana` (turnos enviados/fechados; mínimo 0); semana encerrada usa `dadosOficiais`.
- Sequência do T.19 = um item: saldo = max(Σ metas − Σ realizado, 0); pré-preenchimento e `trazida_de` = último membro.
- Uma origem só pode ser trazida uma vez por semana.
- A semana anterior não muda (PPC e causa ficam como estão).
- Testes: rodar Vitest com cwd `C:\` maiúsculo no PowerShell (ex.: `Set-Location C:\Users\LuisVillaca\Documents\ObraApp; npx vitest run …`).
- Mesmo PR: manual (`lib/ajuda/conteudo/programar-semana.ts`), captura, linha em `lib/ajuda/novidades.ts`; depois deploy na Vercel.

## Review Focus

- Origem apagada depois de trazida → `trazida_de` vira nulo, sem aviso e sem erro na tela.
- Semana N−1 inexistente ou em rascunho → bloco não aparece (nem erro).
- Saldo da origem virou 0 → aviso diz que a semana anterior concluiu; "Atualizar meta" não grava meta 0 (meta > 0 é obrigatória).
- "Atualizar meta" em semana programada com a atividade já num turno → recusado com mensagem clara (reabrir a semana).
- Trazer a mesma origem duas vezes (duas abas) → segunda recusada com "Esta atividade já foi trazida para esta semana."

---

### Task 1: Banco — colunas, validação da origem e exceção da trava

**Files:**
- Create: `supabase/migrations/20261129000000_trazer_saldo.sql`
- Modify: `lib/db/mensagens.ts` (novos `ErroBanco`)
- Test: `tests/integracao/trazer-saldo-banco.test.ts`

**Interfaces:**
- Produces: colunas `programacao_atividades.trazida_de uuid null references programacao_atividades(id) on delete set null`, `saldo_trazido numeric null`; índice único `(semana_id, trazida_de)` where `trazida_de is not null`; RPC `salvar_programacao_atividade` grava `trazida_de`/`saldo_trazido` de `p_dados` **só na inclusão**; `ErroBanco` ganha `"trazida_invalida"` (mensagem "Só dá para trazer atividade da semana anterior desta obra.") e `"meta_trazida_travada"` ("Esta atividade já está num turno. Reabra a semana para mudar a meta.").

Regras do SQL:
- Trigger `tg_programacao_trazida_de` (before insert or update of `trazida_de`, `semana_id`): se `trazida_de` não nulo, exige que a origem esteja numa semana da mesma `obra_id` com `inicio = semana.inicio - 7`; senão `raise 'trazida_invalida'`.
- `tg_programacao_atividades_trava` (recriar): na semana `programada`, um UPDATE em que **só** `meta` e `saldo_trazido` mudam (além de `causa`/`updated_at`), com `old.trazida_de is not null` e `new.meta = new.saldo_trazido`, passa — desde que não exista `atividades` com `programacao_atividade_id = old.id`; existindo, `raise 'meta_trazida_travada'`. O resto da trava fica igual.
- `foto_semana` não muda.

- [ ] **Step 1: Write the failing tests** (`describe.skipIf(!ligado)`, padrão de `sequencia-banco.test.ts`, semanas 2026-11-09 e 2026-11-16)
  - `grava trazida_de e saldo_trazido na inclusão`: atividade na semana 16/11 com `trazida_de` = atividade de 09/11 e `saldo_trazido: 8` → `obterDadosSemana` devolve os dois campos.
  - `recusa origem que não é da semana anterior`: origem na mesma semana → `{ ok: false, erro: "Só dá para trazer atividade da semana anterior desta obra." }`; origem de outra obra → mesmo erro.
  - `recusa trazer a mesma origem duas vezes` → `{ ok: false, erro: "Esta atividade já foi trazida para esta semana." }` (tratar `23505` em `salvarAtividadeProgramada`).
  - `semana programada aceita só meta = saldo_trazido em atividade trazida sem turno`: update direto via `u.cliente.from("programacao_atividades").update({ meta: 5, saldo_trazido: 5 })` passa; `update({ meta: 6 })` (sem mudar saldo_trazido) → erro `semana_travada`; depois de `criarTurno` + `trazerDaProgramacao` → erro `meta_trazida_travada`.
  - `apagar a origem zera trazida_de`.
- [ ] **Step 2: Run** `$env:SUPABASE_TEST='1'; npx vitest run tests/integracao/trazer-saldo-banco.test.ts` → FAIL (coluna inexistente).
- [ ] **Step 3: Write the migration, apply it** (`npx supabase db push` ou o fluxo de migração usado nos itens anteriores) **and add the two `ErroBanco` entries + mensagens; add `trazida_de?: string | null; saldo_trazido?: number | null` to `EntradaAtividadeProgramada`, validated in `validarEntrada` (string não vazia / número ≥ 0), and both fields to `AtividadeProgramada`, the `select` of `obterDadosSemana` and `atividadeDe` (null quando ausente, `numOuNull` no saldo).** Em `salvarAtividadeProgramadaAcao`, ler `trazida_de`/`saldo_trazido` do form só quando não há `atividade_id`.
- [ ] **Step 4: Run** the same command → PASS; run `npx vitest run tests/integracao/programacao-banco.test.ts tests/integracao/sequencia-banco.test.ts` → PASS (trava antiga intacta).
- [ ] **Step 5: Commit** `feat(programacao): trazida_de e saldo_trazido no banco (item 1.6)`

### Task 2: Domínio — pendentes e saldo da origem

**Files:**
- Create: `lib/dominio/trazerSaldo.ts`
- Test: `tests/dominio/trazer-saldo.test.ts`

**Interfaces:**
- Consumes: `ResumoSemana`, `AtividadeResumida` (`lib/dominio/programacao.ts`), `agruparSequencias` (`lib/dominio/sequencia.ts`), `qtdComUnidade` (`lib/dominio/plural.ts`).
- Produces:
  - `type PendenteAnterior = { origem: AtividadeResumida; metaTotal: number; realizado: number; saldo: number }` (`origem` = último membro da sequência).
  - `pendentesDaSemanaAnterior(resumo: ResumoSemana): PendenteAnterior[]` — só saldo > 0, na ordem de `agruparSequencias`.
  - `saldoDaOrigem(resumo: ResumoSemana, origemId: string): number | null` — saldo do grupo que contém `origemId`; `null` se não achar.
  - `textoSaldoMudou(saldoTrazido: number, saldoAtual: number, unidade: string | null): string | null` — `null` se iguais; `"Saldo da semana anterior mudou: era 20 m, agora 12 m."`; se `saldoAtual === 0`: `"A semana anterior concluiu esta atividade (era 20 m). Apague-a se não for mais necessária."`

- [ ] **Step 1: Write the failing tests**
  - atividade solta meta 120, realizado 100 → `[{ saldo: 20, metaTotal: 120, realizado: 100 }]`; cumprida (saldo 0) fica de fora.
  - sequência dia (meta 12, realizado 8) + noite (meta 12, realizado 10) → um item, `saldo: 6`, `origem.id` = noite.
  - `saldoDaOrigem` com id de membro do meio da sequência → saldo do grupo; id inexistente → `null`.
  - `textoSaldoMudou(20, 20, "m")` → `null`; `(20, 12, "m")` → texto acima; `(20, 0, "m")` → texto de concluída.
- [ ] **Step 2: Run** `npx vitest run tests/dominio/trazer-saldo.test.ts` → FAIL (módulo inexistente).
- [ ] **Step 3: Implement** the three functions (arredondar a 2 casas como em `sequencia.ts`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(programacao): saldo da semana anterior no domínio (item 1.6)`

### Task 3: Dados e ações — resumo de N−1 e "Atualizar meta"

**Files:**
- Modify: `lib/db/programacao.ts`
- Modify: `app/(app)/obras/[obraId]/programacao/[inicio]/acoes.ts`
- Test: `tests/integracao/trazer-saldo.test.ts`

**Interfaces:**
- Consumes: Task 1 colunas/erros; Task 2 `saldoDaOrigem`.
- Produces:
  - `resumoSemanaAnterior(c: SupabaseClient, semana: Semana): Promise<ResumoSemana | null>` — `obterSemana(c, obra_id, somarDias(inicio, -7))`; `null` se não existe ou é rascunho; senão `resumirSemana(await dadosOficiais(...))`.
  - `atualizarMetaTrazida(c: SupabaseClient, atividadeId: string): Promise<Resultado<{ meta: number }>>` — lê a atividade (`semana_id`, `trazida_de`), a semana, `resumoSemanaAnterior`, `saldoDaOrigem`; `null` ou sem `trazida_de` → `falha("Esta atividade não veio da semana anterior.")`; saldo 0 → `falha("A semana anterior já concluiu esta atividade.")`; senão `update({ meta: saldo, saldo_trazido: saldo })` e mensagens via `mensagemProgramacao`.
  - Server action `atualizarMetaTrazidaAcao(_: EstadoSemana, form: FormData): Promise<EstadoSemana>` (campo `atividade_id`), chama `atualizar()`.

- [ ] **Step 1: Write the failing tests** (semana 09/11 programada com turno enviado lançando 100 de 120; semana 16/11 em rascunho)
  - `resumoSemanaAnterior` da semana 16/11 → pendente com saldo 20; semana 23/11 sem anterior → `null`; anterior em rascunho → `null`.
  - trazer com `saldo_trazido: 20`, lançar mais 8 na semana 09/11, `atualizarMetaTrazida` → `{ ok: true, dados: { meta: 12 } }` e a atividade fica com meta 12 e saldo_trazido 12.
  - origem concluída (saldo 0) → `{ ok: false, erro: "A semana anterior já concluiu esta atividade." }`.
  - semana 16/11 programada, sem turno → atualiza; com turno da atividade → `{ ok: false, erro: "Esta atividade já está num turno. Reabra a semana para mudar a meta." }`.
- [ ] **Step 2: Run** `$env:SUPABASE_TEST='1'; npx vitest run tests/integracao/trazer-saldo.test.ts` → FAIL.
- [ ] **Step 3: Implement** the two functions and the action.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(programacao): resumo da semana anterior e atualizar meta trazida (item 1.6)`

### Task 4: Tela — bloco "Não concluídas", Trazer e aviso de saldo

**Files:**
- Create: `app/(app)/obras/[obraId]/programacao/[inicio]/NaoConcluidasAnterior.tsx`
- Create: `app/(app)/obras/[obraId]/programacao/[inicio]/AvisoSaldoMudou.tsx`
- Modify: `app/(app)/obras/[obraId]/programacao/[inicio]/page.tsx`, `ListaRascunho.tsx`, `FormAtividadeProgramada.tsx`, `Acompanhamento.tsx`
- Test: `tests/dominio/trazer-saldo-ui.test.tsx`

**Interfaces:**
- Consumes: Task 2 `PendenteAnterior`, `pendentesDaSemanaAnterior`, `saldoDaOrigem`, `textoSaldoMudou`; Task 3 `resumoSemanaAnterior`, `atualizarMetaTrazidaAcao`.
- Produces:
  - `page.tsx` carrega `resumoSemanaAnterior` junto do `Promise.all` (para rascunho e programada) e passa `pendentes: PendenteAnterior[]` e `saldosAtuais: Record<string, number>` (chave = id da atividade trazida desta semana, valor = `saldoDaOrigem`, só quando não `null`).
  - `NaoConcluidasAnterior({ pendentes, trazidas, responsaveis, aoTrazer }: { pendentes: PendenteAnterior[]; trazidas: Set<string>; responsaveis: ResponsavelRef[]; aoTrazer: (p: PendenteAnterior) => void })` — `Cartao` com título "Não concluídas da semana anterior"; linha: descrição · local · `faltam {qtdComUnidade(saldo)} de {qtdComUnidade(metaTotal)}` · "Responsável: …" · botão **Trazer** ou texto "Trazida ✓" (quando `trazidas.has(p.origem.id)`). Não renderiza nada se `pendentes` vazio.
  - `FormAtividadeProgramada` ganha `trazidaDe?: { id: string; saldo: number }` → inputs hidden `trazida_de` e `saldo_trazido`; fecha ao salvar como no `continuaDe`.
  - `ListaRascunho`: estado `copia` ganha `trazidaDe`; "Trazer" chama `duplicar({ ...p.origem, meta: p.saldo }, null)` com `trazidaDe = { id: p.origem.id, saldo: p.saldo }`; título do formulário "Trazida da semana anterior". `trazidas` = ids `trazida_de` das atividades da semana.
  - `AvisoSaldoMudou({ atividade, saldoAtual }: { atividade: AtividadeProgramada; saldoAtual: number })` — `Aviso tom="info"` com `textoSaldoMudou(atividade.saldo_trazido!, saldoAtual, atividade.unidade)`; botão **Atualizar meta** (form → `atualizarMetaTrazidaAcao`) só quando `saldoAtual > 0`; erro da ação num `Aviso tom="alerta"`. Renderiza nada quando o texto é `null`.
  - Rascunho: `ItemRascunho` mostra `AvisoSaldoMudou` quando `saldosAtuais[a.id]` existe. Programada: `Acompanhamento` recebe `atividadesTrazidas` + `saldosAtuais` e mostra um `Cartao` "Saldo da semana anterior mudou" listando os avisos (só se houver algum).

- [ ] **Step 1: Write the failing tests** (Testing Library, padrão de `confirmar-atividade-ui.test.tsx`)
  - `NaoConcluidasAnterior` mostra "faltam 20 m de 120 m" e botão "Trazer"; com a origem em `trazidas` mostra "Trazida ✓" e nenhum botão; lista vazia não renderiza o título.
  - `AvisoSaldoMudou` com saldo_trazido 20 e saldoAtual 12 mostra o texto e o botão "Atualizar meta"; saldoAtual 0 mostra o texto de concluída sem botão; iguais → nada.
- [ ] **Step 2: Run** `npx vitest run tests/dominio/trazer-saldo-ui.test.tsx` → FAIL.
- [ ] **Step 3: Implement** components and wiring.
- [ ] **Step 4: Run** → PASS; `npx tsc --noEmit` e `npm run lint` sem erros.
- [ ] **Step 5: Commit** `feat(programacao): trazer o que ficou da semana anterior (item 1.6)`

### Task 5: Manual, captura, Novidades e backlog

**Files:**
- Modify: `lib/ajuda/conteudo/programar-semana.ts` (seção nova `id: "trazer-semana-anterior"`, depois de `adicionar-atividade`)
- Modify: `tests/manual/capturas.spec.ts` (antes de montar a semana atual: criar e programar via API a semana `hoje − 7` com uma atividade, ex.: "Pintura do galpão", 120 m², para o bloco aparecer; `fotografar(pl, "programar-semana", "trazer-semana-anterior")` com alvo no botão "Trazer")
- Modify: `lib/ajuda/novidades.ts` (linha de 2026-11-24 no topo, `href: "/ajuda/programar-semana#trazer-semana-anterior"`)
- Modify: `docs/backlog.md` (anotar 1.6 em "Feito fora da ordem"); planilha "Backlog Frentia": 1.6 → Feito com data e merge

Texto da seção (título "Traga o que ficou da semana anterior"): no rascunho, o bloco "Não concluídas da semana anterior" lista o que ficou com saldo; "Trazer" abre o formulário já preenchido com a meta = saldo; ajuste dias e responsável e clique em "Adicionar atividade". A semana anterior continua "não cumprida" com sua causa. Se a semana anterior ainda lançar depois, aparece "Saldo da semana anterior mudou" com "Atualizar meta" — vale também na semana programada enquanto a atividade não entrou em nenhum turno. Dica: sequência entra como um item só, com o saldo somado.

- [ ] **Step 1: Write the section, the Novidades line and the capture step.**
- [ ] **Step 2: Run** `$env:SUPABASE_TEST='1'; $env:MANUAL_CAPITULO='programar-semana'; npm run manual:capturas` → passa e gera `public/ajuda/programar-semana-trazer-semana-anterior.png` (conferir a imagem).
- [ ] **Step 3: Run** suíte completa `npx vitest run` (com `SUPABASE_TEST=1`) → PASS.
- [ ] **Step 4: Commit** `docs(manual): trazer o que ficou da semana anterior (item 1.6)`; merge na `main`, deploy na Vercel, atualizar a planilha.
