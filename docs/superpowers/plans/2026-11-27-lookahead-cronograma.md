# 5.1 Lookahead (cronograma importado ou manual) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tela Lookahead (3–6 semanas) alimentada por cronograma da contratada (CSV/xlsx, reimportável pelo código) ou por itens manuais, com "Levar para esta semana" para o rascunho da Programação.

**Architecture:** Lista própria `cronograma_itens` por obra; o lookahead é uma janela calculada por datas (regras puras em `lib/dominio/cronograma.ts`). O arquivo é lido no navegador (linhas → JSON), a prévia usa as mesmas regras puras, e a gravação é uma função SQL transacional. "Levar" reaproveita a página e o formulário da Programação via `?item=<id>`.

**Tech Stack:** Next.js (ler `node_modules/next/dist/docs/` antes de mexer em rotas/server actions), Supabase (RLS + RPC plpgsql), Vitest, Playwright (capturas do manual), `read-excel-file` (xlsx no navegador).

**Spec:** `docs/superpowers/specs/2026-11-27-lookahead-cronograma-design.md`

## Global Constraints

- Nunca `localStorage`/`sessionStorage`; seletor de semanas vai na URL (`?semanas=4`).
- Texto do app: "responsável", nunca "encarregado"; não usar "pleito".
- Migration: conferir o maior número em `supabase/migrations` (hoje `20261205000000`) → usar `20261206000000_cronograma_lookahead.sql`. Aplicar em prod via `npx supabase db query --remote=<ref> --yes -f <arquivo>` **só com OK do Luis**.
- Testes: rodar no PowerShell com cwd `C:\Users\...` (C maiúsculo): `npm test -- <arquivo>`; integração com `$env:SUPABASE_TEST='1'`.
- Limite do arquivo: 5 MB e 5.000 linhas.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branch `lookahead-5-1`.
- Ao fim: manual (`lib/ajuda/`), capturas, fluxograma, Novidades, planilha "Backlog Frentia" (linha 5.1) e deploy na Vercel.

## Review Focus

- CSV do Excel pt-BR: separador `;`, Latin-1, datas `dd/mm/aaaa hh:mm`, BOM no cabeçalho → lido sem erro (teste no Task 2).
- Reimportar o mesmo arquivo duas vezes → 0 novos, 0 atualizados, 0 removidos; nada muda no banco (Task 2 e Task 3).
- Código repetido dentro do arquivo → fica a primeira linha, as outras vão para "ignoradas (código repetido)" (Task 2).
- Item que começa antes e termina depois da janela → aparece em todas as semanas da janela; dias pré-preenchidos = seg–dom dentro do período (Task 2).
- Semana programada/encerrada aberta com `?item=` direto na URL → formulário não abre, sem erro (Task 5).

---

### Task 1: Migration (tabelas, RLS, RPC de importação)

**Files:**
- Create: `supabase/migrations/20261206000000_cronograma_lookahead.sql`
- Test: `tests/integracao/cronograma.test.ts` (só o bloco RLS aqui; o resto no Task 3)

**Interfaces:**
- Produces (SQL):
  - `cronograma_itens(id, obra_id fk obras cascade, origem text check in ('importado','manual'), codigo text, descricao text not null, inicio date not null, fim date not null check (fim >= inicio), local text, unidade text, quantidade numeric check (quantidade is null or quantidade > 0), removido_em timestamptz, created_at, updated_at)`; `check ((origem='importado') = (codigo is not null))`; índice único parcial `(obra_id, codigo) where origem='importado'`.
  - `cronograma_importacoes(id, obra_id fk cascade, arquivo_nome text not null, mapeamento jsonb not null, novos int, atualizados int, removidos int, created_at)`.
  - `programacao_atividades.cronograma_item_id uuid references cronograma_itens(id) on delete set null`.
  - `importar_cronograma(p_obra uuid, p_arquivo text, p_mapeamento jsonb, p_linhas jsonb) returns jsonb` — `security invoker`; `p_linhas` = array de `{codigo, descricao, inicio, fim, local, unidade, quantidade}`; upsert por código (atualiza só se algum campo mudou — `updated_at` só muda nesse caso; limpa `removido_em`), marca `removido_em = now()` nos importados ativos ausentes, não toca manuais, grava `cronograma_importacoes`, devolve `{novos, atualizados, removidos}`.
- RLS das duas tabelas: copiar o padrão de `programacao_atividades`/`problemas_quadro` (acesso pela empresa do membro da obra).

- [ ] **Step 1:** Escrever teste `RLS: outro usuário não vê nem grava itens do cronograma` (dois `criarUsuarioTeste()`; insert do B em obra do A falha; select do B retorna `[]`).
- [ ] **Step 2:** Rodar `$env:SUPABASE_TEST='1'; npm test -- tests/integracao/cronograma.test.ts` → FAIL (tabela não existe).
- [ ] **Step 3:** Escrever a migration; aplicar no banco de dev (mesmo jeito das migrations anteriores do 4.x).
- [ ] **Step 4:** Rodar o teste → PASS.
- [ ] **Step 5:** Commit `feat(lookahead): tabelas do cronograma e importação transacional`.

### Task 2: Regras puras do cronograma

**Files:**
- Create: `lib/dominio/cronograma.ts`, `lib/dominio/arquivoCronograma.ts`
- Test: `tests/dominio/cronograma.test.ts`, `tests/dominio/arquivo-cronograma.test.ts`

**Interfaces (Produces):**
```ts
// cronograma.ts
export type Campo = "codigo" | "descricao" | "inicio" | "fim" | "local" | "quantidade" | "unidade";
export type Mapeamento = Partial<Record<Campo, number>>; // índice da coluna
export type ItemLido = { codigo: string; descricao: string; inicio: string; fim: string; local: string | null; unidade: string | null; quantidade: number | null };
export type ItemCronograma = ItemLido & { id: string; origem: "importado" | "manual"; codigo: string | null; removido_em: string | null; updated_at: string };
export type Ignorada = { linha: number; motivo: "sem código" | "sem descrição" | "data inválida" | "fim antes do início" | "código repetido" };
export function adivinharMapeamento(cabecalho: string[]): Mapeamento;
export function lerData(v: unknown): string | null; // ISO yyyy-mm-dd
export function lerLinhas(linhas: unknown[][], m: Mapeamento): { itens: ItemLido[]; ignoradas: Ignorada[] }; // linhas sem o cabeçalho; nº da linha = índice + 2
export function planoReimportacao(existentes: ItemCronograma[], lidos: ItemLido[]): { novos: number; atualizados: number; removidos: number };
export function semanasDoLookahead(hoje: string, n: 3 | 4 | 5 | 6): string[]; // segundas, começando na semana seguinte à de hoje
export function itensDaSemana<T extends { inicio: string; fim: string }>(itens: T[], segunda: string): T[];
export function diasDoItemNaSemana(item: { inicio: string; fim: string }, segunda: string): DiaSemana[]; // 0 = seg
export function mudouDesdeLevado(item: { updated_at: string }, ultimaLevadaEm: string | null): boolean;
// arquivoCronograma.ts
export function decodificarTexto(bytes: Uint8Array): string; // UTF-8 (tira BOM); se houver U+FFFD, Latin-1
export function lerCsv(texto: string): string[][]; // detecta ; ou , pela 1ª linha; aspas duplas
export async function lerXlsx(arquivo: Blob): Promise<unknown[][]>; // read-excel-file, 1ª planilha
```
Nomes reconhecidos em `adivinharMapeamento` (sem acento/maiúsculas): código ← `id`, `edt`, `wbs`, `activity id`, `codigo`, `código`; descrição ← `nome`, `nome da tarefa`, `task name`, `activity name`, `descricao`, `atividade`; início ← `inicio`, `início`, `start`, `data de inicio`; fim ← `termino`, `término`, `fim`, `finish`; local ← `local`, `area`, `área`; quantidade ← `quantidade`, `qtd`; unidade ← `unidade`, `un`. Quando há mais de uma coluna candidata a código, prefere `edt`/`wbs` (estável entre revisões do Project), depois `activity id`, depois `id`.

`lerData` aceita: número serial do Excel, `Date`, `dd/mm/aaaa`, `dd/mm/aa` (→ 20aa), `aaaa-mm-dd`, qualquer um com hora (`08:00`) ou dia da semana antes (`seg 02/12/26`, como o Project exporta).

- [ ] **Step 1:** Testes em `cronograma.test.ts`:
  - `adivinharMapeamento(["EDT","Nome da tarefa","Início","Término"])` → `{codigo:0, descricao:1, inicio:2, fim:3}`; `["Activity ID","Activity Name","Start","Finish","Area"]` → inclui `local:4`.
  - `lerData("seg 02/12/26 08:00")` = `"2026-12-02"`; `lerData(46096)` = `"2026-03-15"`; `lerData("32/01/2026")` = `null`.
  - `lerLinhas`: linha sem código → ignorada `{linha:2, motivo:"sem código"}`; código repetido → segunda ignorada com `"código repetido"`; quantidade `"1.234,5"` → `1234.5`.
  - `planoReimportacao`: mesmo conteúdo → `{0,0,0}`; descrição mudada → `atualizados:1`; código ausente → `removidos:1`; item já removido que volta → conta em `atualizados`; manuais ignorados.
  - `semanasDoLookahead("2026-11-27", 4)` → `["2026-11-30","2026-12-07","2026-12-14","2026-12-21"]`.
  - `itensDaSemana` com item `2026-11-01..2027-01-31` aparece em todas; item que termina no domingo anterior não aparece.
  - `diasDoItemNaSemana({inicio:"2026-12-02", fim:"2026-12-04"}, "2026-11-30")` → `[2,3,4]`; item que cobre a semana inteira → `[0..6]`.
  - `mudouDesdeLevado({updated_at:"2026-12-02T10:00Z"}, "2026-12-01T10:00Z")` → `true`; `null` → `false`.
- [ ] **Step 2:** Testes em `arquivo-cronograma.test.ts`: CSV `;` com BOM e aspas; bytes Latin-1 de `"Término"` decodificados certo; CSV `,`.
- [ ] **Step 3:** Rodar `npm test -- tests/dominio/cronograma.test.ts tests/dominio/arquivo-cronograma.test.ts` → FAIL.
- [ ] **Step 4:** `npm i read-excel-file`; implementar. (`lerXlsx` fica sem teste unitário; coberto na captura/e2e.)
- [ ] **Step 5:** Rodar → PASS. Commit `feat(lookahead): regras do cronograma e leitura de CSV/xlsx`.

### Task 3: Camada de banco

**Files:**
- Create: `lib/db/cronograma.ts`
- Modify: `lib/db/programacao.ts` (`EntradaAtividadeProgramada` ganha `cronograma_item_id?: string | null`, gravado só na inclusão; `obterDadosSemana` seleciona a coluna; `AtividadeProgramada` em `lib/dominio/programacao.ts` ganha `cronograma_item_id: string | null`)
- Test: `tests/integracao/cronograma.test.ts`

**Interfaces (Produces):**
```ts
export async function listarItensCronograma(c, obraId: string, opcoes?: { incluirRemovidos?: boolean }): Promise<ItemCronograma[]>;
export async function levadasPorItem(c, obraId: string): Promise<Map<string, { inicio: string; created_at: string }[]>>; // semanas (segunda) onde cada item virou atividade
export async function importarCronograma(c, obraId: string, arquivo: string, mapeamento: Mapeamento, itens: ItemLido[]): Promise<Resultado<{ novos: number; atualizados: number; removidos: number }>>; // chama a RPC; recusa > 5000 itens
export async function ultimaImportacao(c, obraId: string): Promise<{ arquivo_nome: string; mapeamento: Mapeamento; created_at: string } | null>;
export async function salvarItemManual(c, obraId: string, e: Omit<ItemLido, "codigo">, id?: string): Promise<Resultado<ItemCronograma>>; // valida descrição, datas, fim>=inicio; recusa editar importado
export async function apagarItemManual(c, id: string): Promise<Resultado>; // recusa apagar importado
export async function obterItemCronograma(c, id: string): Promise<ItemCronograma | null>;
```
- [ ] **Step 1:** Teste `importa, reimporta pelo código e preserva manuais e atividades levadas`: importa 3 itens (A,B,C) → `{3,0,0}`; cria manual M; cria rascunho e atividade com `cronograma_item_id = B`; reimporta (A igual, B com descrição nova, sem C, com D) → `{1,1,1}`; C tem `removido_em`; M intacto; atividade de B mantém a descrição antiga; reimportar o mesmo arquivo → `{0,0,0}`; `ultimaImportacao` devolve o mapeamento.
- [ ] **Step 2:** Teste `manual: valida e não deixa editar/apagar importado`.
- [ ] **Step 3:** Rodar → FAIL. **Step 4:** Implementar. **Step 5:** PASS; rodar `npm test` inteiro (nada quebrou na programação). Commit `feat(lookahead): banco do cronograma`.

### Task 4: Tela Lookahead e importação

**Files:**
- Create: `app/(app)/obras/[obraId]/lookahead/page.tsx` (server: lê `?semanas`, itens, levadas, status das semanas da janela via `obterSemana`), `.../lookahead/acoes.ts` (server actions: `importarCronogramaAcao`, `salvarItemManualAcao`, `apagarItemManualAcao`, `levarParaSemanaAcao`), `.../lookahead/SubirCronograma.tsx` (client: escolher arquivo → ler → prévia com um `<select>` por campo, 5 primeiras linhas, contagens de `planoReimportacao` + lista de ignoradas → Confirmar), `.../lookahead/FormItemManual.tsx`, `.../lookahead/SemanaLookahead.tsx`
- Modify: `lib/dominio/navegacao.ts` (`Etapa` ganha `"lookahead"`; em `ETAPAS` entra **antes** de Programação: `{ id: "lookahead", rotulo: "Lookahead", sufixo: "/lookahead" }`), `components/navegacao/MenuLateral.tsx` (ícone da etapa), teste existente de navegação se houver (`tests/dominio/*navegacao*`).

Comportamento (copy fixa):
- Topo: `Lookahead`, seletor `3 · 4 · 5 · 6 semanas` (links com `?semanas=`), botões `Subir cronograma` e `Adicionar item`, linha `Última importação: <arquivo> em dd/mm às hh:mm` (ou `Nenhum cronograma importado — adicione itens à mão ou suba o arquivo do Project/Primavera em Excel ou CSV.`).
- Bloco por semana: `Semana de dd/mm` + selo do status (`Sem programação` / `Rascunho` / `Programada` / `Encerrada`, reaproveitar `ROTULO_STATUS_SEMANA`/`TOM_STATUS_SEMANA`). Vazio: `Nada do cronograma nesta semana.`
- Item: descrição; código (se houver); `dd/mm – dd/mm`; local; `quantidade unidade`; selos `Manual`, `Saiu do cronograma`, `Na semana de dd/mm` (um por semana levada), `Mudou desde que foi levado`. Manual tem `Editar`/`Apagar`.
- Itens com `removido_em` e sem atividade levada ficam ocultos; link `Mostrar removidos (n)` (`?removidos=1`).
- `Levar para esta semana`: desativado com `Semana já programada` se status programada/encerrada. `levarParaSemanaAcao(obraId, segunda, itemId)` chama `criarRascunho` e `redirect` para `/obras/{obraId}/programacao/{segunda}?item={itemId}`.
- Prévia: `X novos · Y atualizados · Z saem do cronograma` e `W linhas ignoradas` (expansível com `linha N: motivo`). Arquivo > 5 MB ou > 5000 linhas: `Arquivo grande demais (máx. 5 MB / 5.000 linhas).` Faltando campo obrigatório no mapeamento: Confirmar desativado com `Escolha as colunas de código, descrição, início e término.`

- [ ] **Step 1:** Atualizar/criar teste de navegação: `etapaDoCaminho("/obras/x/lookahead") === "lookahead"`, `ETAPAS[0].id === "lookahead"` → FAIL → implementar → PASS.
- [ ] **Step 2:** Implementar a página e os componentes.
- [ ] **Step 3:** Verificar no app rodando (`npm run dev`, skill `run`): subir um CSV de exemplo pt-BR (`;`, Latin-1) e um xlsx, prévia certa, confirmar, reimportar, item manual, mostrar removidos, celular (390 px).
- [ ] **Step 4:** `npm run lint` e `npx tsc --noEmit` limpos. Commit `feat(lookahead): tela do lookahead com importação e itens manuais`.

### Task 5: Levar para a semana (Programação)

**Files:**
- Modify: `app/(app)/obras/[obraId]/programacao/[inicio]/page.tsx` (lê `?item`; se semana em rascunho e item da obra existe, abre `FormAtividadeProgramada` com `doCronograma`), `.../FormAtividadeProgramada.tsx` (nova prop `doCronograma?: { itemId: string; descricao: string; local: string | null; unidade: string | null; quantidade: number | null; dias: DiaSemana[] }` → pré-preenche descrição, local, unidade, meta = quantidade, dias, período diurno; campo oculto `cronograma_item_id`), `.../acoes.ts` (`salvarAtividadeProgramadaAcao` lê `cronograma_item_id` só na inclusão), `.../ListaRascunho.tsx` e a grade/lista de semana programada (mostra `Cronograma: <código>` discreto quando a atividade tem item importado; manual mostra `Do lookahead`).
- Test: `tests/integracao/cronograma.test.ts` (atividade salva com `cronograma_item_id` aparece em `levadasPorItem`; apagar item manual deixa a atividade com `cronograma_item_id = null`).

- [ ] **Step 1:** Escrever os 2 testes → FAIL. **Step 2:** Implementar. **Step 3:** PASS.
- [ ] **Step 4:** No app: Levar → cai na semana com o formulário aberto e preenchido; salvar; voltar ao Lookahead mostra `Na semana de dd/mm`; levar de novo cria segunda atividade; `?item=` numa semana programada não abre formulário.
- [ ] **Step 5:** Commit `feat(lookahead): levar item do lookahead para a semana`.

### Task 6: Manual, capturas, fluxograma, Novidades, entrega

**Files:**
- Create: `lib/ajuda/conteudo/lookahead.ts` (seguir o formato de `programar-semana.ts`: o que é, subir cronograma do Project/Primavera em Excel/CSV, colunas, reimportar, itens manuais, levar para a semana)
- Modify: `lib/ajuda/capitulos.ts`, `lib/ajuda/fluxograma.ts` (passo Lookahead antes de Programar a semana), `lib/ajuda/novidades.ts` (linha de 2026-11-27: `Lookahead: veja as próximas 3 a 6 semanas, suba o cronograma do Project ou Primavera (Excel/CSV) ou adicione itens à mão, e leve cada item para a programação da semana.`), roteiro de capturas do manual (mesmo lugar dos outros capítulos em `tests/manual/`)
- [ ] **Step 1:** Escrever; rodar `npm test -- tests/dominio/ajuda` (fidelidade/capturas/busca) → PASS.
- [ ] **Step 2:** `$env:SUPABASE_TEST='1'; $env:MANUAL_CAPITULO='lookahead'; npm run manual:capturas` → capturas geradas.
- [ ] **Step 3:** `npm test` inteiro + `npm run build` → verdes. Commit `docs(ajuda): capítulo do lookahead`.
- [ ] **Step 4:** Pedir OK ao Luis para aplicar a migration em prod; merge na main; deploy Vercel; conferir em www.frentia.com.br.
- [ ] **Step 5:** Planilha "Backlog Frentia" linha 5.1 → `Feito` com nota (data, merge, migration); memória do roadmap.
