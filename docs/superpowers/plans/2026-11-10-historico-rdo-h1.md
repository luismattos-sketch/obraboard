# Histórico de RDO H1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada fechamento de turno emite uma versão numerada e imutável do RDO (foto JSON no banco). O PDF de cada versão pode ser baixado, e há telas de RDOs por obra e geral.

**Architecture:** Um gatilho `after update of status` em `turnos` grava em `rdo_versoes` a foto montada por `public.foto_rdo(turno_id)`, na mesma transação do fechamento. O app só lê: funções puras transformam a foto em `TurnoCompleto` (reaproveitando `DocumentoRdo`) e agrupam as versões para as listas. As rotas de PDF montam o documento a partir da foto, ou a partir dos dados atuais no caso do rascunho.

**Tech Stack:** Next.js (App Router, ver `node_modules/next/dist/docs/` antes de criar rotas/páginas), Supabase (Postgres + RLS), `@react-pdf/renderer`, Vitest, Playwright, Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-10-historico-rdo-h1-design.md`

## Global Constraints

- Nunca usar `localStorage`/`sessionStorage`; filtros vão na query (`?mes=AAAA-MM`, `?obra=<uuid>`).
- Textos da interface e do PDF em pt-BR; datas e horas no fuso `America/Sao_Paulo`, usando `dataHoraBrasilia` (`"09/11/2026 às 18:40"`).
- O app nunca grava em `rdo_versoes`; só o gatilho e a migration gravam.
- A foto (`formato = 1`) nunca inclui `token_hash`.
- Nome de arquivo: `RDO-<slug obra>-<AAAA-MM-DD>-<periodo>-v<N>.pdf` (oficial) e `…-rascunho.pdf` (prévia).
- Testes: `npx vitest run`. Integração: `SUPABASE_TEST=1 npx vitest run tests/integracao`. E2E: `SUPABASE_TEST=1 npx playwright test`.
- Cada task termina com commit na branch `historico-rdo`; mensagens no estilo `feat(rdo): …` com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Reabrir → editar → fechar**: a v1 continua byte a byte igual no `dados`, e a v2 reflete a edição (Task 1).
2. **Fechamento recusado por causa pendente**: nenhuma versão é criada (Task 1).
3. **Usuário de outra empresa** abrindo `/api/rdo/versao/<id>` de outra empresa recebe 404, nunca um PDF (Tasks 4 e 5).
4. **`?mes=` inválido** (`2026-13`, `abc`, array) cai em "Todos" sem erro, e **`?obra=` de obra inexistente** mostra a lista vazia, sem erro (Task 2).
5. **Turno reaberto** aparece na lista com o selo "Turno reaberto" e a versão oficial anterior continua baixável (Tasks 2 e 7).

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20261110000000_rdo_versoes.sql` (novo) | Tabela, `foto_rdo`, gatilho, RLS, retroativas |
| `lib/rdo/versao.ts` (novo) | Puro: `lerFoto`, `Emissao`, `emissaoDaVersao`, `linhasEmissao` |
| `lib/dominio/historico-rdo.ts` (novo) | Puro: `ItemVersao`, `normalizarMes`, `mesesDisponiveis`, `agruparVersoes`, `rotuloMes` |
| `lib/rdo/nome-arquivo.ts` | Sufixo de versão/rascunho |
| `lib/rdo/formatar.ts` | `dataHoraCurta` |
| `lib/rdo/documento.tsx` | Prop `emissao` no lugar de `geradoEm` |
| `lib/db/rdo-versoes.ts` (novo) | Leitura de `rdo_versoes` |
| `lib/rdo/responder.ts` (novo) | Monta a `Response` de PDF (oficial e rascunho) |
| `app/api/rdo/versao/[versaoId]/route.ts` (novo) | Download de versão |
| `app/api/rdo/[turnoId]/route.ts` | Fechado → última versão; aberto → rascunho |
| `app/(app)/obras/[obraId]/turnos/[turnoId]/BlocoRdo.tsx` (novo) | Botões de download na tela do turno |
| `components/ui/Expansivel.tsx` (movido de `analise/`) | Acordeão compartilhado |
| `components/rdo/ListaRdos.tsx`, `components/rdo/FiltrosRdo.tsx` (novos) | Lista e filtros compartilhados |
| `app/(app)/obras/[obraId]/rdos/page.tsx`, `app/(app)/rdos/page.tsx` (novos) | Telas |
| `components/navegacao/MenuLateral.tsx` | Item "RDOs" |

---

### Task 1: Migration `rdo_versoes` + testes de integração do banco

**Files:**
- Create: `supabase/migrations/20261110000000_rdo_versoes.sql`
- Test: `tests/integracao/rdo-versoes-banco.test.ts`

**Interfaces:**
- Produces: tabela `public.rdo_versoes(id, turno_id, obra_id, numero, emitido_em, retroativa, formato, dados, created_at)`; função `public.foto_rdo(p_turno_id uuid) returns jsonb` (execute só para `service_role`).

- [ ] **Step 1: Write the failing tests** em `tests/integracao/rdo-versoes-banco.test.ts`, no padrão de `tests/integracao/turnos.test.ts` (`describe.skipIf(!ligado)`, `criarUsuarioTeste`, obra própria por teste, `aplicarAcao` para liberar/enviar/fechar/reabrir, atividade com `qtd_realizada` e horário real preenchidos para conseguir fechar). Use um helper `versoes(turnoId)` que lê com o cliente admin `rdo_versoes` ordenado por `numero`.
  - `"fechar cria a v1 com a foto do turno"`: depois de fechar, há 1 linha com `numero 1`, `retroativa false`, `formato 1`, `emitido_em` igual ao `fechado_em` do turno; `dados.obra.nome === "Obra RDO"`, `dados.turno.data`, `dados.atividades[0].descricao`, `dados.efetivo`, `dados.clima`; `JSON.stringify(dados)` não contém `token_hash`.
  - `"reabrir, editar e fechar cria a v2 sem mudar a v1"`: guarda `v1.dados`; reabre, edita a descrição da atividade (`editarAtividade`), fecha; espera 2 versões, `v1.dados` deep-equal ao guardado e `v2.dados.atividades[0].descricao` com o novo texto.
  - `"fechamento recusado não cria versão"`: atividade não concluída sem causa; `aplicarAcao(...,"fechar")` retorna `ok: false`; `versoes` vazio.
  - `"o app não grava nem apaga versões"`: com `u.cliente`, `insert`, `update({ numero: 9 })` e `delete()` em `rdo_versoes` retornam `error` não nulo, e a linha continua igual (relida pelo admin).
  - `"outra empresa não lê versões"`: um segundo usuário recebe `[]` em `select` de `rdo_versoes` por `turno_id`; o dono recebe 1 linha.
  - `"foto_rdo devolve a mesma foto do gatilho"`: `admin.rpc("foto_rdo", { p_turno_id })` em um turno fechado (ainda não reaberto) é deep-equal ao `dados` da v1; com `u.cliente`, a mesma chamada retorna `error`.
  - `"removerTurno recusa turno reaberto com versão"`: depois de fechar e reabrir, `removerTurno` retorna `ok: false`.

- [ ] **Step 2: Run to verify it fails**
Run: `SUPABASE_TEST=1 npx vitest run tests/integracao/rdo-versoes-banco.test.ts`
Expected: FAIL (`relation "public.rdo_versoes" does not exist`).

- [ ] **Step 3: Write the migration**

```sql
-- Histórico de RDO H1: versões oficiais imutáveis emitidas ao fechar o turno.
create table public.rdo_versoes (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references public.turnos(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  numero integer not null check (numero > 0),
  emitido_em timestamptz not null,
  retroativa boolean not null default false,
  formato integer not null default 1,
  dados jsonb not null,
  created_at timestamptz not null default now(),
  unique (turno_id, numero)
);
create index rdo_versoes_obra_emitido_idx on public.rdo_versoes (obra_id, emitido_em desc);

create or replace function public.foto_rdo(p_turno_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'obra', (select jsonb_build_object('id', o.id, 'empresa_id', o.empresa_id, 'nome', o.nome,
                                       'cliente', o.cliente, 'endereco', o.endereco)
             from public.obras o where o.id = t.obra_id),
    'turno', jsonb_build_object('id', t.id, 'obra_id', t.obra_id, 'data', t.data, 'periodo', t.periodo,
      'hora_inicio_prevista', t.hora_inicio_prevista, 'hora_fim_prevista', t.hora_fim_prevista,
      'hora_inicio_real', t.hora_inicio_real, 'hora_fim_real', t.hora_fim_real,
      'enviado_em', t.enviado_em, 'fechado_em', t.fechado_em),
    'atividades', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'ordem', a.ordem,
        'descricao', a.descricao, 'local', a.local, 'unidade', a.unidade,
        'qtd_planejada', a.qtd_planejada, 'qtd_realizada', a.qtd_realizada, 'causa', a.causa,
        'observacao', a.observacao, 'origem_id', a.origem_id) order by a.ordem, a.created_at)
      from public.atividades a where a.turno_id = t.id), '[]'::jsonb),
    'efetivo', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'funcao', e.funcao,
        'quantidade', e.quantidade) order by e.created_at)
      from public.efetivo e where e.turno_id = t.id), '[]'::jsonb),
    'clima', coalesce((select jsonb_agg(jsonb_build_object('periodo', c.periodo, 'condicao', c.condicao,
        'impediu', c.impediu) order by c.periodo)
      from public.clima c where c.turno_id = t.id), '[]'::jsonb))
  from public.turnos t where t.id = p_turno_id;
$$;
revoke all on function public.foto_rdo(uuid) from public, anon, authenticated;
grant execute on function public.foto_rdo(uuid) to service_role;
```

Then add:
- `public.tg_emitir_rdo_versao()`: `returns trigger`, `security definer`, `set search_path = ''`. Insere `(turno_id, obra_id, numero, emitido_em, dados)` com `numero = coalesce((select max(numero) from public.rdo_versoes where turno_id = new.id), 0) + 1`, `emitido_em = coalesce(new.fechado_em, now())` e `dados = public.foto_rdo(new.id)`; `return null`.
- `create trigger turnos_emitir_rdo after update of status on public.turnos for each row when (old.status is distinct from 'fechado' and new.status = 'fechado') execute function public.tg_emitir_rdo_versao();`.
- RLS: `alter table … enable row level security`; `revoke all on public.rdo_versoes from anon, authenticated; grant select on public.rdo_versoes to authenticated; grant all on public.rdo_versoes to service_role;`; política `rdo_versoes_select for select to authenticated using (exists (select 1 from public.obras o where o.id = rdo_versoes.obra_id and public.eh_membro(o.empresa_id)))`.
- Retroativas: `insert into public.rdo_versoes (turno_id, obra_id, numero, emitido_em, retroativa, dados) select t.id, t.obra_id, 1, coalesce(t.fechado_em, t.updated_at), true, public.foto_rdo(t.id) from public.turnos t where t.status = 'fechado' and not exists (select 1 from public.rdo_versoes v where v.turno_id = t.id);`.

- [ ] **Step 4: Apply to the dev Supabase** (`zhkotvvqiarzcovdmzky`). Do it the same way as the previous migrations: ask the user to paste the file into the dev project's SQL Editor, with step-by-step guidance on the panel, and wait for confirmation. Then confirm with `select count(*) from rdo_versoes where retroativa` (it should equal the number of closed turnos in dev).

- [ ] **Step 5: Run to verify it passes**
Run: `SUPABASE_TEST=1 npx vitest run tests/integracao`
Expected: all PASS, including the existing ones. Cleanup through `removerUsuarioTeste` still works thanks to the cascade.

- [ ] **Step 6: Commit** `feat(rdo): tabela rdo_versoes com emissão no fechamento e retroativas`

---

### Task 2: Domínio puro — foto, emissão, nome de arquivo, agrupamento

**Files:**
- Create: `lib/rdo/versao.ts`, `lib/dominio/historico-rdo.ts`
- Modify: `lib/rdo/nome-arquivo.ts`, `lib/rdo/formatar.ts`
- Test: `tests/dominio/rdo-versao.test.ts`, `tests/dominio/historico-rdo.test.ts`, `tests/dominio/rdo.test.tsx` (nome de arquivo)

**Interfaces:**
- Produces (`lib/rdo/versao.ts`):
  - `type VersaoRdo = { id: string; turno_id: string; obra_id: string; numero: number; emitido_em: string; retroativa: boolean; formato: number; dados: unknown }`
  - `class FormatoRdoDesconhecido extends Error`
  - `lerFoto(v: Pick<VersaoRdo, "formato" | "dados">): TurnoCompleto`: `status: "fechado"`, `token_hash: null`, `obra.created_at: ""`, `turno_id` preenchido em atividades/efetivo/clima, atividades normalizadas com `normalizarAtividade` e ordenadas por `ordem`. Para `formato !== 1`, lança `FormatoRdoDesconhecido`.
  - `type Emissao = { tipo: "oficial"; numero: number; emitidoEm: Date; retroativa: boolean; anterior?: { numero: number; emitidoEm: Date } } | { tipo: "rascunho"; geradoEm: Date }`
  - `emissaoDaVersao(v: VersaoRdo, anterior?: { numero: number; emitido_em: string }): Emissao`
  - `linhasEmissao(e: Emissao): { destaque: string; rodape: string }`
- Produces (`lib/dominio/historico-rdo.ts`):
  - `type ItemVersao = { id: string; turnoId: string; obraId: string; obraNome: string; numero: number; emitidoEm: string; retroativa: boolean; data: string; periodo: Periodo; turnoStatus: StatusTurno; percentual: number | null }`
  - `type GrupoRdo = { turnoId: string; obraId: string; obraNome: string; data: string; periodo: Periodo; reaberto: boolean; atual: ItemVersao; anteriores: ItemVersao[] }`
  - `normalizarMes(v: unknown): string | null`, `mesesDisponiveis(itens: Pick<ItemVersao, "data">[]): string[]`, `agruparVersoes(itens: ItemVersao[], mes: string | null): GrupoRdo[]`, `rotuloMes(mes: string): string`
- Produces: `nomeArquivoRdo(obra, data, periodo, sufixo?: { versao: number } | "rascunho")`; `dataHoraCurta(d: Date): string` (`"09/11 às 18:40"`, fuso SP).

- [ ] **Step 1: Write the failing tests**
  - `lerFoto`: uma foto de exemplo com atividades fora de ordem e `qtd_planejada` como número volta como `TurnoCompleto` com `status "fechado"`, atividades em ordem de `ordem` e `turno_id` igual a `turno.id`; `formato: 2` lança `FormatoRdoDesconhecido`.
  - `linhasEmissao` (datas em UTC; `2026-11-09T21:40:00Z` = 18:40 SP; `2026-11-10T11:15:00Z` = 08:15):
    - v1: `destaque === "RDO oficial · Versão 1 · Emitido em 10/11/2026 às 08:15 (horário de Brasília)"`, `rodape === "Versão 1 · Emitido em 10/11/2026 às 08:15 (horário de Brasília)"`.
    - v2 com anterior: `destaque === "RDO oficial · Versão 2 · substitui a versão 1, emitida em 09/11/2026 às 18:40 · Emitido em 10/11/2026 às 08:15 (horário de Brasília)"`.
    - retroativa v1: o destaque termina com `" · versão registrada retroativamente"`.
    - rascunho: `destaque === "Rascunho — não é o RDO oficial · Gerado em 10/11/2026 às 08:15 (horário de Brasília)"`, `rodape === "Rascunho · Gerado em 10/11/2026 às 08:15 (horário de Brasília)"`.
  - `emissaoDaVersao`: `anterior` só aparece quando é passado; `emitidoEm` é um `Date` de `emitido_em`.
  - `nomeArquivoRdo("Edifício Aurora","2026-11-08","diurno",{ versao: 2 })` → `"RDO-edificio-aurora-2026-11-08-diurno-v2.pdf"`; com `"rascunho"` → `"…-diurno-rascunho.pdf"`; sem sufixo, o resultado é o mesmo de hoje (os testes atuais continuam passando).
  - `normalizarMes`: `"2026-11"` → `"2026-11"`; `"2026-13"`, `"2026-1"`, `"abc"`, `undefined`, `["2026-11"]` → `null`.
  - `mesesDisponiveis`: datas `2026-10-31`, `2026-11-02`, `2026-11-09` → `["2026-11","2026-10"]`.
  - `agruparVersoes`: versões v1 e v2 do turno A (09/11) e v1 do turno B (31/10). Com `mes null`: 2 grupos, A primeiro, `A.atual.numero === 2`, `A.anteriores.map(n) === [1]`. Com `"2026-10"`: só B. Com `turnoStatus "enviado"` no item atual: `reaberto === true`. No mesmo dia, ordenar como `listarTurnos` (inverso de `compararTurnos`).
  - `rotuloMes("2026-11")` → `"novembro de 2026"`.

- [ ] **Step 2: Run to verify it fails**
Run: `npx vitest run tests/dominio/rdo-versao.test.ts tests/dominio/historico-rdo.test.ts tests/dominio/rdo.test.tsx`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implement** os arquivos acima com as assinaturas definidas. `agruparVersoes` agrupa por `turnoId`; `atual` é a versão de maior `numero`, e os campos do grupo (`obraNome`, `data`, `periodo`) vêm dela; `anteriores` ficam em ordem decrescente de `numero`.

- [ ] **Step 4: Run to verify it passes** (mesmo comando) → PASS.

- [ ] **Step 5: Commit** `feat(rdo): domínio de versões (foto, emissão, agrupamento)`

---

### Task 3: `DocumentoRdo` com `emissao`

**Files:**
- Modify: `lib/rdo/documento.tsx`, `tests/dominio/rdo.test.tsx`

**Interfaces:**
- Consumes: `Emissao`, `linhasEmissao` (Task 2).
- Produces: `DocumentoRdo(props: { turno: TurnoCompleto; resumo: ResumoTurno; emissao: Emissao })`. A prop `geradoEm` deixa de existir.

- [ ] **Step 1: Update the tests**: os renders atuais passam `emissao={{ tipo: "rascunho", geradoEm }}` ou `{ tipo: "oficial", numero: 1, emitidoEm: geradoEm, retroativa: false }`. Adicionar `"marca RASCUNHO só no rascunho"`: o PDF sai comprimido, então o teste verifica a função exportada `marcaDagua(emissao: Emissao): string | null` (`"RASCUNHO"` no rascunho, `null` na oficial) e confirma que os dois renders começam com `%PDF`.
- [ ] **Step 2: Run** `npx vitest run tests/dominio/rdo.test.tsx` → FAIL.
- [ ] **Step 3: Implement**:
  - A marca-d'água passa a vir de `marcaDagua(emissao)` (substitui o "PRELIMINAR" baseado em status).
  - Uma linha `destaque` aparece abaixo do cabeçalho fixo, só na 1ª página, com o estilo novo `s.emissao` (corpo 9, negrito, cor primária) em `lib/rdo/estilos.ts`.
  - O rodapé fica `${rodape} · Status: ${ROTULO_STATUS_TURNO[turno.status]}`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(rdo): cabeçalho de versão e marca de rascunho no PDF`

---

### Task 4: Leitura de versões (`lib/db/rdo-versoes.ts`)

**Files:**
- Create: `lib/db/rdo-versoes.ts`
- Test: `tests/integracao/rdo-versoes-leitura.test.ts`

**Interfaces:**
- Consumes: `VersaoRdo` (Task 2), `ItemVersao` (Task 2), `percentualCumprimento`.
- Produces:
  - `listarVersoes(c: SupabaseClient, filtro: { obraId?: string }): Promise<ItemVersao[]>`: seleciona `id, turno_id, obra_id, numero, emitido_em, retroativa, data:dados->turno->>data, periodo:dados->turno->>periodo, obra_nome:dados->obra->>nome, atividades:dados->atividades, turno:turnos(status)`; calcula `percentual` com `percentualCumprimento`; `obraId` que não é UUID válido → `[]`; outro erro → `throw`.
  - `obterVersao(c, id: string): Promise<VersaoRdo | null>`: UUID inválido ou não visível → `null`.
  - `versoesDoTurno(c, turnoId: string): Promise<{ id: string; numero: number; emitido_em: string }[]>`: em ordem crescente de `numero`.

- [ ] **Step 1: Write the failing tests** (integração): depois de fechar, reabrir e fechar um turno, `versoesDoTurno` devolve `[1,2]`; `listarVersoes(u.cliente, { obraId })` devolve 2 itens com `data`, `periodo`, `obraNome`, `turnoStatus "fechado"` e `percentual` numérico; `obterVersao` com o id da v1 devolve `dados` não nulo. Para um segundo usuário, `obterVersao` → `null` e `listarVersoes` → `[]`; `obterVersao(c, "xyz")` → `null`; `listarVersoes(c, { obraId: "xyz" })` → `[]`.
- [ ] **Step 2: Run** `SUPABASE_TEST=1 npx vitest run tests/integracao/rdo-versoes-leitura.test.ts` → FAIL.
- [ ] **Step 3: Implement**, seguindo o padrão de erros de `lib/db/turnos.ts` (`UUID_INVALIDO = "22P02"`, `console.error` + `throw`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(rdo): leitura de versões`

---

### Task 5: Rotas de download

**Files:**
- Create: `lib/rdo/responder.ts`, `app/api/rdo/versao/[versaoId]/route.ts`
- Modify: `app/api/rdo/[turnoId]/route.ts`
- Test: `tests/dominio/rdo-responder.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces:
  - `respostaPdf(turno: TurnoCompleto, emissao: Emissao, nomeArquivo: string): Promise<Response>`: mesmos cabeçalhos de hoje (`application/pdf`, `attachment; filename="…"`, `no-store`).
  - `respostaVersao(c: SupabaseClient, versaoId: string): Promise<Response>`: `obterVersao` → `null` dá 404 `{ erro: "RDO não encontrado" }`; busca a anterior por `versoesDoTurno` quando `numero > 1`; `lerFoto` lança erro → `console.error` + 500 `{ erro: "Não foi possível gerar o RDO" }`; nome do arquivo com `{ versao: numero }` e o nome da obra que está na foto.

- [ ] **Step 1: Write the failing test** `respostaPdf`: devolve status 200, `Content-Disposition` com o nome passado e corpo começando com `%PDF`. A rota em si é coberta pelo E2E (Task 9).
- [ ] **Step 2: Run** `npx vitest run tests/dominio/rdo-responder.test.ts` → FAIL.
- [ ] **Step 3: Implement**:
  - Rota nova `GET /api/rdo/versao/[versaoId]`: mesma checagem de login e redirect de `app/api/rdo/[turnoId]/route.ts` (com `voltar` apontando para `/api/rdo/versao/<id>`), depois `respostaVersao`.
  - Rota existente: se o turno estiver `fechado`, `versoesDoTurno` → última → `respostaVersao` (sem versão → `console.error` + 500). Se estiver aberto, `respostaPdf(turno, { tipo: "rascunho", geradoEm: new Date() }, nomeArquivoRdo(..., "rascunho"))`.
  - Ambas com `runtime = "nodejs"` e `dynamic = "force-dynamic"`.
- [ ] **Step 4: Run** `npx vitest run` e `npx tsc --noEmit` → PASS / sem erros.
- [ ] **Step 5: Commit** `feat(rdo): download de versões oficiais e prévia em rascunho`

---

### Task 6: Botões de RDO na tela do turno

**Files:**
- Create: `app/(app)/obras/[obraId]/turnos/[turnoId]/BlocoRdo.tsx`
- Modify: `app/(app)/obras/[obraId]/turnos/[turnoId]/page.tsx`, `AcoesTurno.tsx` (remover o link "Baixar RDO (PDF)")
- Test: `tests/dominio/bloco-rdo.test.tsx`

**Interfaces:**
- Consumes: `versoesDoTurno` (Task 4), `dataHoraCurta` (Task 2).
- Produces: `BlocoRdo(props: { turnoId: string; fechado: boolean; versoes: { id: string; numero: number; emitido_em: string }[] })`, um componente de servidor dentro de `Cartao`.

- [ ] **Step 1: Write the failing tests** (`renderToStaticMarkup`, como em `analise-ui.test.tsx`):
  - fechado com v1 e v2: link `"Baixar RDO (v2)"` com `href="/api/rdo/versao/<id v2>"`; texto `"Versões anteriores:"` e link `"v1 (09/11 às 18:40)"`.
  - aberto sem versões: só `"Baixar prévia (rascunho)"` com `href="/api/rdo/<turnoId>"`.
  - aberto com v1: `"Baixar prévia (rascunho)"` e `"Baixar v1 oficial"`.
- [ ] **Step 2: Run** `npx vitest run tests/dominio/bloco-rdo.test.tsx` → FAIL.
- [ ] **Step 3: Implement**: na página, quando o status não for `planejado`, buscar `versoesDoTurno` em paralelo e renderizar `<BlocoRdo>` logo depois de `<Resumo>`.
- [ ] **Step 4: Run** `npx vitest run` → PASS.
- [ ] **Step 5: Commit** `feat(rdo): botões de versão e rascunho na tela do turno`

---

### Task 7: Lista compartilhada + tela `/obras/[obraId]/rdos`

**Files:**
- Move: `app/(app)/obras/[obraId]/analise/Expansivel.tsx` → `components/ui/Expansivel.tsx` (atualizar o import em `analise/page.tsx` e em `tests/dominio/analise-ui.test.tsx`)
- Create: `components/rdo/ListaRdos.tsx`, `components/rdo/FiltrosRdo.tsx`, `app/(app)/obras/[obraId]/rdos/page.tsx`
- Modify: `app/(app)/obras/[obraId]/page.tsx` (botão "RDOs" antes de "Análise (PPC)")
- Test: `tests/dominio/lista-rdos.test.tsx`

**Interfaces:**
- Consumes: `GrupoRdo`, `agruparVersoes`, `mesesDisponiveis`, `normalizarMes`, `rotuloMes` (Task 2); `listarVersoes` (Task 4).
- Produces:
  - `ListaRdos(props: { grupos: GrupoRdo[]; mostrarObra: boolean })`.
  - `FiltrosRdo(props: { acao: string; meses: string[]; mes: string | null; obras?: { id: string; nome: string }[]; obra?: string | null })`: um `<form method="get" action={acao}>` com `<select name="mes">` ("Todos" com valor vazio e `rotuloMes` em cada opção), `<select name="obra">` opcional e o botão "Filtrar". Funciona sem JavaScript.

- [ ] **Step 1: Write the failing tests**:
  - Linha com v2 e v1: mostra data `formatarData`, rótulo do período, `"67%"`, selo `"v2"` e link `"Baixar"` para `/api/rdo/versao/<id v2>`; dentro do `<details>`, `"v1 · emitida 09/11 às 18:40"` com o link correspondente.
  - Linha com uma versão só: sem `<details>`.
  - `reaberto` → selo `"Turno reaberto"`.
  - `mostrarObra` → nome da obra visível.
  - `grupos` vazio → `"Nenhum RDO emitido ainda. O RDO é registrado quando você fecha um turno."`.
- [ ] **Step 2: Run** `npx vitest run tests/dominio/lista-rdos.test.tsx tests/dominio/analise-ui.test.tsx` → FAIL.
- [ ] **Step 3: Implement**. A página segue o modelo de `analise/page.tsx`: `obterObra` (ou `notFound`), `normalizarMes(searchParams.mes)`, `listarVersoes(c, { obraId })` dentro de try/catch (erro → `Aviso` "Não foi possível carregar os RDOs. Tente novamente."), link "← <obra>", título "RDOs", filtros e lista. Um `mes` que não esteja nas opções continua filtrando (a lista sai vazia).
- [ ] **Step 4: Run** `npx vitest run` → PASS.
- [ ] **Step 5: Commit** `feat(rdo): tela de RDOs da obra`

---

### Task 8: Tela geral `/rdos` + item no menu

**Files:**
- Create: `app/(app)/rdos/page.tsx`
- Modify: `components/navegacao/MenuLateral.tsx`
- Test: `tests/dominio/navegacao.test.ts` (se o estado ativo virar função pura) ou o próprio E2E

**Interfaces:**
- Consumes: `ListaRdos`, `FiltrosRdo` (Task 7); `listarVersoes`; `listarObras`.

- [ ] **Step 1: Implement the page**: `?obra=` (repassado ao `listarVersoes` quando for UUID válido; caso contrário vale como "Todas") e `?mes=`. O filtro de obras vem de `listarObras`, e a lista usa `mostrarObra`. Título "RDOs".
- [ ] **Step 2: Add the menu item**: um bloco fixo entre o `<nav aria-label="Obras">` e o rodapé do usuário, com um `Link href="/rdos"`, ícone de documento (`"M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6"`) e rótulo "RDOs". Segue o mesmo padrão do "Nova obra" (rótulo `md:sr-only` quando recolhido, `title` quando recolhido), com `aria-current="page"` quando `caminho === "/rdos"`.
- [ ] **Step 3: Run** `npx vitest run`, `npx tsc --noEmit` e `npx eslint` → sem falhas.
- [ ] **Step 4: Commit** `feat(rdo): tela geral de RDOs e item no menu`

---

### Task 9: E2E + verificação final + prévia

**Files:**
- Modify: `tests/e2e/ciclo-turno.spec.ts`

- [ ] **Step 1: Update the E2E**:
  - Depois de fechar, o link vira `"Baixar RDO (v1)"` e o download sugere `RDO-obra-e2e-${dataTurno}-diurno-v1.pdf`.
  - Pré-aquecer `${obraUrl}/rdos` e `/rdos` com `page.request.get`.
  - Na obra, clicar em "RDOs" e ver a linha com "v1".
  - Reabrir o turno: aparece "Baixar prévia (rascunho)" e "Baixar v1 oficial".
  - Fechar de novo: em "RDOs" da obra aparece "v2", e ao abrir o `<details>` aparece a linha "v1 · emitida".
  - Em `/rdos`, a linha mostra o nome da obra.
- [ ] **Step 2: Run** `SUPABASE_TEST=1 npx playwright test` → PASS.
- [ ] **Step 3: Full verification**: `npx vitest run`, `SUPABASE_TEST=1 npx vitest run tests/integracao`, `npx tsc --noEmit`, `npx eslint` e `npx next build` → tudo verde.
- [ ] **Step 4: Commit** `test(e2e): ciclo com versões do RDO`
- [ ] **Step 5: Final review** por um subagente opus sobre a branch inteira. Corrigir os achados e repetir o Step 3.
- [ ] **Step 6: Push** `git push -u origin historico-rdo` (gera a prévia no Vercel). O usuário valida.
- [ ] **Step 7: After approval**: aplicar a migration no Supabase de produção (`ybhojqmhacrpusduodfi`) pelo SQL Editor, com o usuário guiado no painel, e conferir a contagem de retroativas = turnos fechados. Depois `git checkout main`, `git merge --no-ff historico-rdo` e `git push`. A migration vai **antes** do merge para que a produção nunca rode código que lê uma tabela que ainda não existe.
