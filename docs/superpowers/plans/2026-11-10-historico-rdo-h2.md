# Histórico de RDO H2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Linha do tempo de marcos de cada turno, registrada por gatilhos no banco, com motivo obrigatório ao reabrir. O motivo aparece no histórico e no PDF da versão seguinte.

**Architecture:** Uma migration cria `turnos.motivo_reabertura`, a tabela `turno_eventos` (somente leitura para o app), um gatilho `before` que exige o motivo e gatilhos `after` que registram os eventos. Ela também refaz `foto_rdo` para incluir o motivo. No app: domínio puro (`lib/dominio/eventos.ts`), leitura (`lib/db/eventos.ts`), `aplicarAcao` com motivo, formulário de reabertura, bloco `HistoricoTurno` e o motivo no destaque do PDF.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), `@react-pdf/renderer`, Vitest, Playwright, Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-10-historico-rdo-h2-design.md`

## Global Constraints

- Nunca usar `localStorage`/`sessionStorage`.
- Textos em pt-BR; horários no fuso SP via `dataHoraCurta` (`"10/11 às 07:02"`) e `dataHoraBrasilia`.
- O app nunca grava em `turno_eventos`.
- Motivo: `trim`, de 3 a 500 caracteres. Mensagens: `"Informe o motivo da reabertura"` e `"O motivo pode ter até 500 caracteres"`.
- O gatilho de eventos se chama `turnos_registrar_evento`, para disparar depois de `turnos_emitir_rdo` (ordem alfabética).
- A foto continua com `formato = 1`; o novo campo `turno.motivo_reabertura` é opcional.
- Testes: `npx vitest run`; integração `SUPABASE_TEST=1 npx vitest run tests/integracao`; E2E `SUPABASE_TEST=1 npx playwright test`.
- Commits na branch `historico-rdo-h2`, com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Gerar novo link durante a liberação** não pode criar um evento `novo_link` extra: liberar troca `token_hash` e status juntos (Task 1).
2. **Motivo só com espaços** (`"   "`) precisa ser recusado no app e no banco (Tasks 1 e 3).
3. **Fotos da H1 sem `motivo_reabertura`** continuam abrindo o PDF, sem a linha de motivo (Task 2).
4. **Turno reaberto duas vezes**: a v3 mostra o motivo da 2ª reabertura e o histórico mostra os dois motivos (Task 1).
5. **Turno criado antes da H2**: aparece a nota "Histórico registrado a partir de 10/11/2026", sem erro (Task 4).

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20261110010000_turno_eventos.sql` (novo) | Coluna, tabela, gatilhos, RLS, `foto_rdo` com motivo |
| `lib/dominio/eventos.ts` (novo) | Puro: `EventoTurno`, `validarMotivo`, `rotuloEvento`, `rotuloAtor` |
| `lib/db/eventos.ts` (novo) | `listarEventos` |
| `lib/db/turnos.ts`, `lib/db/mensagens.ts` | `aplicarAcao` com motivo; erro `motivo_obrigatorio` |
| `lib/rdo/versao.ts` | Motivo na `Emissao` e no destaque |
| `app/(app)/obras/[obraId]/turnos/[turnoId]/acoes.ts`, `AcoesTurno.tsx` | Formulário de reabertura |
| `app/(app)/obras/[obraId]/turnos/[turnoId]/HistoricoTurno.tsx` (novo), `page.tsx` | Bloco Histórico |

---

### Task 1: Migration + reabrir com motivo no `aplicarAcao` + integração

**Files:**
- Create: `supabase/migrations/20261110010000_turno_eventos.sql`, `lib/dominio/eventos.ts` (somente `validarMotivo` nesta task), `tests/integracao/turno-eventos.test.ts`
- Modify: `lib/db/turnos.ts` (`aplicarAcao`), `lib/db/mensagens.ts`
- Modify (tests that reopen): `tests/integracao/execucao.test.ts:82`, `invariantes.test.ts:141`, `link.test.ts:73`, `rdo-versoes-banco.test.ts:77,128`, `rdo-versoes-leitura.test.ts:30` → passar `{ motivo: "Correção de teste" }`

**Interfaces:**
- Produces: `validarMotivo(texto: unknown): Resultado<string>` (de `lib/db/resultado`); `aplicarAcao(c, turnoId, acao, opcoes?: { motivo?: string })`; `ErroBanco` inclui `"motivo_obrigatorio"`; `ERRO_MOTIVO = "Informe o motivo da reabertura"` exportado de `lib/dominio/eventos.ts`.

- [ ] **Step 1: Write the failing tests** em `tests/integracao/turno-eventos.test.ts`. Mesmo padrão de `rdo-versoes-banco.test.ts`, com o helper `eventos(turnoId)` lendo `turno_eventos` pelo cliente admin, ordenado por `em, id`.
  - `"ciclo completo registra os marcos na ordem"`: criar turno → liberar → `gerarNovoLink` → executar a atividade (com causa) → enviar pelo campo com `enviarTurnoCampo(token)` de `lib/db/campo.ts` (o token vem do `gerarNovoLink`) → fechar → reabrir `{ motivo: "  Corrigir quantidade  " }` → fechar. Esperado em `tipo`: `["criado","liberado","novo_link","enviado","fechado","reaberto","fechado"]`. O `enviado` tem `ator_tipo "encarregado"` e `ator_nome null`. Os outros têm `ator_tipo "planejador"` e `ator_nome` igual ao e-mail do usuário de teste, porque `criarUsuarioTeste` não grava nome. As `versao` dos dois `fechado` são `1` e `2`. O motivo do `reaberto` é `"Corrigir quantidade"`.
  - `"foto da v2 traz o motivo e a v1 não"`: no `rdo_versoes` do mesmo turno, `dados.turno.motivo_reabertura` é `null` na v1 e `"Corrigir quantidade"` na v2 (`aplicarAcao` grava o motivo já com trim).
  - `"reabrir duas vezes: v3 com o 2º motivo"`: os motivos `"Primeiro"` e `"Segundo ajuste"` levam a eventos `reaberto` com os dois motivos e `v3.dados.turno.motivo_reabertura === "Segundo ajuste"`.
  - `"banco recusa reabrir sem motivo"`: com `u.cliente`, `update({ status: "enviado", fechado_em: null })` direto num turno fechado retorna `error.message === "motivo_obrigatorio"`. O mesmo vale para `motivo_reabertura: "   "`. O status continua `fechado`.
  - `"aplicarAcao valida o motivo"`: `aplicarAcao(..., "reabrir")` sem opções → `{ ok: false, erro: "Informe o motivo da reabertura" }`; com `"ab"` → mesma mensagem; com 501 caracteres → `"O motivo pode ter até 500 caracteres"`.
  - `"o app não grava nem apaga eventos"`: `insert`, `update` e `delete` com `u.cliente` retornam erro.
  - `"outra empresa não lê eventos"`: outro usuário recebe `[]`.

- [ ] **Step 2: Run** `SUPABASE_TEST=1 npx vitest run tests/integracao/turno-eventos.test.ts` → FAIL (tabela inexistente ou `aplicarAcao` sem motivo).

- [ ] **Step 3: Write the migration**:
  - `alter table public.turnos add column motivo_reabertura text;`
  - Tabela `turno_eventos` conforme a spec, seção 1, com os checks de `tipo` e `ator_tipo`. Índice `(turno_id, em)`. RLS, `revoke`/`grant select` e a política `turno_eventos_select` idênticos aos de `rdo_versoes`.
  - `tg_exigir_motivo_reabertura()` (`before update of status`, `search_path = ''`) conforme a spec, levantando `raise exception 'motivo_obrigatorio' using errcode = 'P0001'`. O gatilho se chama `turnos_exigir_motivo`.
  - `tg_registrar_evento_turno()` (`security definer`, `search_path = ''`): uma única função para `insert` e `update` (`tg_op`), com as regras da spec. O ator é lido com `select coalesce(nullif(btrim(u.raw_user_meta_data->>'nome'), ''), u.email) from auth.users u where u.id = auth.uid()`. Gatilhos `turnos_registrar_evento_criado after insert` e `turnos_registrar_evento after update of status, token_hash`. `revoke all` em public/anon/authenticated.
  - `create or replace function public.foto_rdo` igual à da migration H1, acrescentando `'motivo_reabertura', t.motivo_reabertura` em `'turno'`.

- [ ] **Step 4: Implement the app side**:
  - `validarMotivo` em `lib/dominio/eventos.ts`.
  - Em `aplicarAcao`, para `"reabrir"`: `validarMotivo(opcoes?.motivo)`; em caso de falha, retorna antes de ler o turno. Em sucesso, `mudancas.motivo_reabertura = motivo`.
  - O erro de banco `motivo_obrigatorio` vira `falha(ERRO_MOTIVO)`.
  - Atualizar as chamadas de teste listadas em Files.

- [ ] **Step 5: Apply to the dev Supabase**: o usuário cola o arquivo no SQL Editor do projeto `zhkotvvqiarzcovdmzky`, com guia passo a passo, e confirma.

- [ ] **Step 6: Run** `SUPABASE_TEST=1 npx vitest run tests/integracao` → todos PASS.

- [ ] **Step 7: Commit** `feat(historico): eventos do turno e motivo obrigatório ao reabrir`

---

### Task 2: Domínio dos eventos + motivo no PDF

**Files:**
- Modify: `lib/dominio/eventos.ts`, `lib/rdo/versao.ts`
- Test: `tests/dominio/eventos.test.ts`, `tests/dominio/rdo-versao.test.ts`

**Interfaces:**
- Produces: `type TipoEvento = "criado" | "liberado" | "novo_link" | "enviado" | "fechado" | "reaberto"`; `type EventoTurno = { id: string; tipo: TipoEvento; em: string; atorTipo: "planejador" | "encarregado"; atorNome: string | null; versao: number | null; motivo: string | null }`; `rotuloEvento(e: Pick<EventoTurno, "tipo" | "versao">): string`; `rotuloAtor(e: Pick<EventoTurno, "atorTipo" | "atorNome">): string`; `Emissao` oficial com `motivo?: string`; `emissaoDaVersao` lê o motivo da foto (`dados.turno.motivo_reabertura`) quando `numero > 1`.

- [ ] **Step 1: Write the failing tests**:
  - `validarMotivo`: `""`, `"   "` e `"ab"` → `ERRO_MOTIVO`; `"  abc  "` → `ok("abc")`; 500 caracteres → ok; 501 → `"O motivo pode ter até 500 caracteres"`; `undefined` e `123` → `ERRO_MOTIVO`.
  - `rotuloEvento`: os rótulos exatos da spec; `{ tipo: "fechado", versao: 2 }` → `"Fechado · RDO v2 emitido"`; `{ tipo: "fechado", versao: null }` → `"Fechado"`.
  - `rotuloAtor`: `"Luis"`; encarregado → `"Encarregado (link de campo)"`; planejador sem nome → `"—"`.
  - `linhasEmissao` v2 com `motivo: "Corrigir quantidade"` → destaque `"RDO oficial · Versão 2 · substitui a versão 1, emitida em 09/11/2026 às 18:40 · Motivo da correção: Corrigir quantidade · Emitido em 10/11/2026 às 08:15 (horário de Brasília)"`.
  - `emissaoDaVersao`: uma foto v2 com `turno.motivo_reabertura: "X"` gera `motivo: "X"`; uma v1 com motivo na foto não gera motivo; uma foto sem o campo (formato H1) não gera motivo.
- [ ] **Step 2: Run** `npx vitest run tests/dominio/eventos.test.ts tests/dominio/rdo-versao.test.ts` → FAIL.
- [ ] **Step 3: Implement** (`lerFoto` não muda: `TurnoCompleto` não precisa do motivo).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(historico): rótulos de eventos e motivo no PDF`

---

### Task 3: Formulário de reabertura

**Files:**
- Modify: `app/(app)/obras/[obraId]/turnos/[turnoId]/acoes.ts`, `AcoesTurno.tsx`
- Test: `tests/dominio/acoes-turno.test.tsx`

**Interfaces:**
- Consumes: `aplicarAcao(..., { motivo })` (Task 1).
- Produces: `TEXTO_REABERTURA = "O motivo fica registrado no histórico e no próximo RDO oficial."` exportado de `AcoesTurno.tsx`.

- [ ] **Step 1: Write the failing test** (`renderToStaticMarkup`): `<AcoesTurno turnoId="t" fechado />` mostra o botão `"Reabrir turno"` e ainda não mostra `name="motivo"`. O formulário aberto não é coberto aqui, porque depende de estado do cliente, e fica com o E2E (Task 4). Também verifica que `TEXTO_REABERTURA` está exportado com o texto exato.
- [ ] **Step 2: Run** → FAIL (`TEXTO_REABERTURA` inexistente).
- [ ] **Step 3: Implement**:
  - `reabrirTurnoAcao` passa `{ motivo: texto(form, "motivo") }`.
  - Em `AcoesTurno`, "Reabrir turno" vira `type="button"` e define um estado `reabrindoForm`. O formulário tem `<label>Motivo da reabertura</label>`, `<textarea name="motivo" required minLength={3} maxLength={500}>`, `Aviso tom="info"` com `TEXTO_REABERTURA` e os botões "Confirmar reabertura" (submit, `carregando`) e "Cancelar".
- [ ] **Step 4: Run** `npx vitest run` → PASS.
- [ ] **Step 5: Commit** `feat(historico): reabrir pede o motivo`

---

### Task 4: Bloco Histórico na tela do turno + E2E

**Files:**
- Create: `lib/db/eventos.ts`, `app/(app)/obras/[obraId]/turnos/[turnoId]/HistoricoTurno.tsx`
- Modify: `page.tsx` (turno), `tests/e2e/ciclo-turno.spec.ts`
- Test: `tests/dominio/historico-turno.test.tsx`, `tests/integracao/turno-eventos.test.ts` (com `listarEventos`)

**Interfaces:**
- Consumes: `EventoTurno`, `rotuloEvento`, `rotuloAtor` (Task 2); `versoesDoTurno` (H1).
- Produces: `listarEventos(c, turnoId): Promise<EventoTurno[]>`, em ordem `em` crescente e depois `id`; UUID inválido → `[]`; outro erro → `throw`. `HistoricoTurno(props: { eventos: EventoTurno[] | null; versoes: { id: string; numero: number }[] })`, onde `null` significa erro de leitura.

- [ ] **Step 1: Write the failing tests**:
  - Integração: `listarEventos` no turno do ciclo devolve 7 eventos com `atorTipo` e `versao` mapeados; para outra empresa → `[]`; para `"xyz"` → `[]`.
  - UI:
    - com eventos `criado` e `fechado(v1)`, o resumo é `"Histórico (2)"`, a linha contém `"10/11 às 07:02 · Turno criado · Luis"` e `"RDO v1"` é um link para `/api/rdo/versao/<id v1>`;
    - `reaberto` mostra o motivo;
    - sem `criado`, aparece `"Histórico registrado a partir de 10/11/2026"`;
    - `eventos={null}` → `"Não foi possível carregar o histórico"`;
    - `[]` → `"Histórico (0)"` com a nota.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**:
  - Na página, `listarEventos` entra no `Promise.all` com `.catch(() => null)`.
  - `<HistoricoTurno>` vai no fim da página, em todos os status.
  - O link "RDO vN" substitui o trecho "RDO vN" do rótulo quando existe uma versão com aquele número.
- [ ] **Step 4: Update the E2E**:
  - Na reabertura, clicar em "Reabrir turno", preencher `"Motivo da reabertura"` com `"Corrigir quantidade"` e clicar em "Confirmar reabertura".
  - Depois do 2º fechamento, abrir `"Histórico ("` e ver `"Enviado pelo campo"`, `"Fechado · RDO v2 emitido"` (ou o link "RDO v2") e `"Corrigir quantidade"`.
- [ ] **Step 5: Run** `npx vitest run`, `SUPABASE_TEST=1 npx vitest run tests/integracao`, `SUPABASE_TEST=1 npx playwright test`, `npx tsc --noEmit`, `npx eslint` e `npx next build` → tudo verde.
- [ ] **Step 6: Commit** `feat(historico): bloco Histórico na tela do turno`
- [ ] **Step 7: Final review** por um subagente opus; fix pass; push `git push -u origin historico-rdo-h2` para a prévia. Depois da validação do usuário: migration em produção (SQL Editor, conferindo que `turno_eventos` existe e que `turnos.motivo_reabertura` existe), então merge `--no-ff` na `main` + push.
