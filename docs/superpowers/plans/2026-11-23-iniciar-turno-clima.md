# Iniciar turno por equipe e clima no campo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada responsável toca "Iniciar turno" (hora do toque, por equipe); o horário real do turno passa a vir do primeiro início e do último "Terminei"; o clima volta a ser editável no campo, com "última alteração" para o planejador.

**Architecture:** Nova tabela `turno_equipes_iniciadas`, espelho de `turno_equipes_terminadas` (mesmos triggers e RLS). Um sincronizador no servidor (`lib/db/horarioReal.ts`) recalcula `turnos.hora_inicio_real/hora_fim_real` após iniciar/desfazer/terminar/desfazer, usando uma função pura de domínio. Clima volta pelas ações de campo removidas no item 10 (commit d7d9325), agora com autor (`clima.lancado_por_id`, `clima.lancado_em`).

**Tech Stack:** Next.js (ler `node_modules/next/dist/docs/` antes de mexer em rotas/ações), Supabase (Postgres + RLS), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-23-iniciar-turno-clima-design.md`

## Global Constraints

- Nunca `localStorage`/`sessionStorage`; estado oficial no Supabase.
- No app nunca "encarregado" — usar "responsável".
- Hora do toque vem do aparelho (`horaAgoraSaoPaulo()`), validada no servidor com `horaValida` — mesmo padrão do Terminei.
- Repetir o toque é sucesso; vale o primeiro horário gravado (insert com `23505` ignorado).
- Iniciar **não** bloqueia lançamento.
- "Ver tudo" (`responsavelId === null` com responsáveis no turno) continua só leitura, inclusive clima e Iniciar.
- Turno sem responsáveis (fluxo antigo): volta o `BlocoHorario` editável + `BlocoClima` no campo, como antes do item 10.
- Manual (`lib/ajuda/`), capturas (`SUPABASE_TEST=1 npm run manual:capturas`), fluxograma se a sequência mudar, linha em `lib/ajuda/novidades.ts`, deploy na Vercel ao fim.

## Review Focus

- Turno noturno (19:00→05:00): "primeiro início"/"último terminei" pela ordem dos toques (`created_at`), nunca comparando `time` (00:30 < 19:00 quebraria).
- Fim real só existe quando **todas** as equipes com atividade terminaram; Desfazer Terminei de qualquer uma volta `hora_fim_real` a null.
- Desfazer o único Iniciar volta `hora_inicio_real` a null; desfazer o primeiro de dois passa o início para o segundo.
- Correção do planejador em horário persiste até o próximo toque no campo (o sincronizador só roda nas ações do campo).
- Turno fechado: iniciar/desfazer recusados com `ERRO_FECHADO_CAMPO` (trigger `tg_bloquear_turno_fechado`).

---

### Task 1: Banco — iniciadas por equipe e autor do clima

**Files:**
- Create: `supabase/migrations/20261126000000_iniciar_turno.sql`
- Test: `tests/integracao/iniciar-turno.test.ts`

**Interfaces:**
- Produces: tabela `turno_equipes_iniciadas(turno_id uuid, responsavel_id uuid, iniciou_em time not null, created_at timestamptz default now(), primary key (turno_id, responsavel_id))`; colunas `clima.lancado_por_id uuid null references responsaveis(id) on delete set null`, `clima.lancado_em timestamptz null`.

- [ ] **Step 1:** Escrever a migração copiando o bloco "2." de `20261118000000_aviso_parada.sql` (tabela, índice por responsável, triggers `tg_bloquear_turno_fechado` e `tg_responsavel_mesma_obra`, RLS, grants, policy `turno_equipes_iniciadas_all`). Adicionar as duas colunas em `clima` e o trigger `tg_responsavel_mesma_obra` em `clima` (`before insert or update of lancado_por_id`) — conferir que a função trata `lancado_por_id` (se ela só olha colunas fixas, criar `tg_clima_autor_mesma_obra` equivalente).
- [ ] **Step 2:** Teste de integração "turno fechado recusa iniciada" e "responsável de outra obra recusado" (admin insert direto → erro).
- [ ] **Step 3:** Aplicar no Supabase de teste (`npx supabase db push`, como nas migrações anteriores) e rodar `npx vitest run tests/integracao/iniciar-turno.test.ts` com `SUPABASE_TEST=1` → PASS.
- [ ] **Step 4:** Commit `feat(banco): turno_equipes_iniciadas e autor do clima`.

### Task 2: Domínio — horário real a partir das equipes

**Files:**
- Modify: `lib/dominio/efetivoHH.ts` (junto de `Terminado`/`lerTerminados`)
- Test: `tests/dominio/horarioReal.test.ts`

**Interfaces:**
- Produces:
  - `type Iniciado = { responsavel_id: string; iniciou_em: string }` e `lerIniciados(x: unknown): Iniciado[]` (mesmo formato de `lerTerminados`, ordenado por `iniciou_em`).
  - `horarioRealDasEquipes(p: { iniciados: { iniciou_em: string; created_at: string }[]; terminados: { responsavel_id: string; terminou_em: string; created_at: string }[]; equipes: string[] }): { hora_inicio_real: string | null; hora_fim_real: string | null }`

- [ ] **Step 1: Testes**
  - nenhum iniciado → `{ hora_inicio_real: null, hora_fim_real: null }`
  - iniciados `[{07:12, t1}, {06:58, t2}]` (t1 < t2) → início `"07:12"` (ordem do toque, não do relógio)
  - noturno: iniciados `[{19:05, t1}]`, equipes `[A,B]`, terminados `A 04:40 t5`, `B 00:30 t3` → fim `"04:40"` (mais recente por `created_at`)
  - equipes `[A,B]`, só A terminou → fim `null`
  - `equipes` vazio → fim `null`
- [ ] **Step 2:** `npx vitest run tests/dominio/horarioReal.test.ts` → FAIL.
- [ ] **Step 3:** Implementar (início = `iniciou_em` do menor `created_at`; fim = `terminou_em` do maior `created_at` se todo id de `equipes` está em `terminados`; saída em `HH:MM` via `horaCurta`).
- [ ] **Step 4:** Rodar → PASS. Commit `feat(dominio): horário real a partir das equipes`.

### Task 3: Servidor — iniciar/desfazer e sincronizar horário

**Files:**
- Create: `lib/db/iniciados.ts`, `lib/db/horarioReal.ts`
- Modify: `lib/db/terminados.ts` (chamar o sincronizador após marcar e desfazer), `app/t/[token]/acoes.ts`, `lib/db/turnos.ts` (embed `turno_equipes_iniciadas(responsavel_id, iniciou_em)` em `obterTurnoCompleto`, campo `iniciados?: Iniciado[]` em `TurnoCompleto`), `lib/db/quadro.ts` (mesmo embed na linha 26, `iniciados` na entrada ao vivo; snapshots antigos ficam sem → `[]`)
- Test: `tests/integracao/iniciar-turno.test.ts`

**Interfaces:**
- Consumes: `horarioRealDasEquipes`, `lerIniciados` (Task 2); `turnoAberto(token)` de `lib/db/campo.ts`.
- Produces:
  - `marcarIniciouCampo(token: string, responsavelId: string, hora: string): Promise<Resultado>`
  - `desfazerIniciouCampo(token: string, responsavelId: string): Promise<Resultado>`
  - `sincronizarHorarioReal(admin: Admin, turnoId: string): Promise<void>` — lê iniciadas, terminadas (com `created_at`) e os `responsavel_id` distintos não nulos das atividades; grava `hora_inicio_real/hora_fim_real` no turno; falha só loga (o toque vale).
  - Ações de campo `marcarInicio(token, responsavelId, hora)` e `desfazerInicio(token, responsavelId)` em `app/t/[token]/acoes.ts`.
  - `TurnoCompleto.iniciados` e `EntradaQuadro.iniciados?: Iniciado[]`.

- [ ] **Step 1: Testes de integração** (cenário igual ao de `terminados.test.ts`, Ana e João):
  - Ana inicia 07:12 → turno `hora_inicio_real` `07:12:00`; repetir com 07:20 → continua `07:12:00`, `ok`.
  - João inicia 07:30, Ana desfaz → início `07:30:00`.
  - Ana e João terminam (com causas OK) → `hora_fim_real` = hora do último; João desfaz Terminei → `hora_fim_real` null.
  - hora inválida `"25:00"` → `falha("Informe o horário")`.
  - turno fechado → `ERRO_FECHADO_CAMPO`.
  - `obterTurnoCompleto(...).iniciados` traz `{ responsavel_id, iniciou_em }`.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar seguindo `marcarTerminouCampo`/`desfazerTerminouCampo` (mesmo `traduzir`).
- [ ] **Step 4:** Rodar integração + `tests/integracao/terminados.test.ts` → PASS. Commit `feat(campo): iniciar turno por equipe e horário real automático`.

### Task 4: Servidor — clima no campo com autor

**Files:**
- Modify: `lib/db/campo.ts` (restaurar `salvarClima`/`removerClima` de antes de d7d9325, agora com `responsavelId: string | null`), `app/t/[token]/acoes.ts` (restaurar `salvarClima(token, dados, responsavelId)` e `limparClima(token, periodo)`), `lib/db/execucao.ts` (`salvarClimaPlanejador` grava `lancado_por_id: null, lancado_em: now`), `lib/db/turnos.ts` (`Clima` ganha `lancado_por_id?: string | null; lancado_em?: string | null`; embed `clima(..., lancado_por_id, lancado_em)`)
- Test: `tests/integracao/campo.test.ts`

**Interfaces:**
- Produces: `salvarClima(token: string, dados: { periodo: PeriodoClima; condicao: CondicaoClima; impediu: boolean }, responsavelId: string | null): Promise<Resultado>` gravando `lancado_por_id = responsavelId`, `lancado_em = new Date().toISOString()`.

- [ ] **Step 1:** Recolocar/ajustar os testes de clima removidos em d7d9325 (`git show d7d9325 -- tests/integracao/campo.test.ts`) e acrescentar: salvar com Ana → linha com `lancado_por_id = ana`; planejador salva → `lancado_por_id` null e `lancado_em` preenchido.
- [ ] **Step 2:** Rodar → FAIL. **Step 3:** Implementar. **Step 4:** Rodar → PASS. Commit `feat(campo): clima volta ao campo com autor`.

### Task 5: Tela do campo — botão Iniciar e clima

**Files:**
- Create: `components/execucao/BotaoIniciar.tsx`
- Modify: `app/t/[token]/FormularioCampo.tsx`, `app/t/[token]/page.tsx` (passar `iniciados: turno.iniciados ?? []`)
- Test: `tests/dominio/botao-iniciar.test.tsx`, `tests/e2e/campo-permissoes.spec.ts`

**Interfaces:**
- Consumes: ações `marcarInicio`, `desfazerInicio`, `salvarClima`, `limparClima`.
- Produces: `BotaoIniciar({ iniciouEm: string | null; marcar: (hora: string) => void; desfazer: () => void; salvando?: boolean })`.

Textos fixos: botão `"Iniciar turno"`; depois `"✓ Você iniciou às {HH:MM}"` + botão `"Desfazer"`. Ajuda abaixo do botão (antes de iniciar): `"Toque quando sua equipe começar. A hora fica registrada para o planejador."`

- [ ] **Step 1: Teste de componente:** sem `iniciouEm` mostra botão "Iniciar turno"; clicar chama `marcar` com `"HH:MM"`; com `iniciouEm="07:12:00"` mostra "✓ Você iniciou às 07:12" e "Desfazer" chama `desfazer`.
- [ ] **Step 2:** Rodar → FAIL. **Step 3:** Implementar (estilo de `BotaoTerminei`, botão primário em destaque, `min-h-12`).
- [ ] **Step 4:** No `FormularioCampo`:
  - com responsável escolhido e turno editável: `BotaoIniciar` no topo (antes de `DadosDoTurno`), estado otimista como `terminouEm`.
  - `DadosDoTurno` mostra só "Início real · Fim real"; a frase "Horário e clima são preenchidos pelo planejador." sai.
  - `BlocoClima` volta (no lugar de antes, depois das atividades) com `somenteLeitura={leitura}`, `salvar={(d) => salvarClima(token, d, responsavelId)}`.
  - turno sem responsáveis: `BlocoHorario` editável como antes de 2f8d9de (restaurar `salvarHorarioReal` de campo só para esse caso — servidor recusa se o turno tem atividade com responsável).
- [ ] **Step 5:** Atualizar `tests/e2e/campo-permissoes.spec.ts`: Ana vê "Iniciar turno", toca, vê "✓ Você iniciou às"; mostra "Início real: HH:MM"; clima editável (`select` do período existe e salva); Ver tudo continua sem input habilitado e sem "Iniciar turno". Ajustar `ciclo-turno.spec.ts`/`programacao.spec.ts` que esperam o texto antigo.
- [ ] **Step 6:** `npx vitest run` e `SUPABASE_TEST=1 npx playwright test --project="Desktop Chrome" tests/e2e/campo-permissoes.spec.ts tests/e2e/ciclo-turno.spec.ts` → PASS. Commit `feat(campo): botão Iniciar turno e clima no celular`.

### Task 6: Planejador e quadro — horários por equipe e autor do clima

**Files:**
- Modify: `lib/dominio/quadro.ts` (`ResumoEquipe.iniciouEm: string | null`, preenchido como `terminouEm`), `components/quadro/Quadro.tsx` (linha 96: `"iniciou 07:12 · ✓ terminou 16:40"`; só o que existir), `app/(app)/obras/[obraId]/turnos/[turnoId]/FaixaParadas.tsx` (+ `acoesExecucao.ts` `paradasDoTurnoAcao` devolve `iniciados`) mostrando `"▶ {nome} iniciou às HH:MM"` antes dos terminados, `app/(app)/obras/[obraId]/turnos/[turnoId]/EdicaoExecucao.tsx` (nota abaixo do `BlocoClima`: `"Última alteração: {ultimaAlteracao(...)}"` do registro de clima com `lancado_em` mais recente)
- Test: `tests/dominio/quadro.test.ts` (ou o arquivo existente que cobre `terminouEm`), `tests/dominio/ultimaAlteracao.test.ts`

- [ ] **Step 1:** Testes: faixa com iniciado `07:12:00` → `resumo.iniciouEm === "07:12"`; sem → `null`. `ultimaAlteracao` já cobre clima pelo mesmo formato (`lancado_por_id`/`lancado_em`) — adicionar caso com o clima.
- [ ] **Step 2:** FAIL → implementar → PASS. Commit `feat(quadro): início e fim por equipe; autor do clima`.

### Task 7: Manual, Novidades, backlog e publicação

**Files:**
- Modify: `lib/ajuda/` (capítulo do campo: Iniciar turno, clima pelo responsável; capítulo do turno do planejador: horário automático, correção), `lib/ajuda/fluxograma.ts` (passo "Iniciar turno" antes de lançar), `lib/ajuda/novidades.ts` (uma linha: "Responsável toca Iniciar turno; o horário real do turno sai sozinho do primeiro início e do último Terminei. Clima volta a ser lançado no campo."), `docs/backlog.md` (nota no item 10: correção; novo item "HH pela janela de cada equipe"), testes do manual que conferem texto.

- [ ] **Step 1:** Atualizar textos; procurar "preenchidos pelo planejador" em `lib/ajuda` e trocar.
- [ ] **Step 2:** `SUPABASE_TEST=1 MANUAL_CAPITULO=<campo> npm run manual:capturas` (e o do turno) → capturas novas.
- [ ] **Step 3:** `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build` → sem erros. Commit `docs(manual): iniciar turno e clima no campo; capturas`.
- [ ] **Step 4:** Migração no Supabase de produção, merge em main, deploy Vercel; conferir no ar.
