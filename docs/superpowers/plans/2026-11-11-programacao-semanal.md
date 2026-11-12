# Programação semanal + efetivo previsto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O planejador programa a semana (atividades com meta, dias, período e equipe prevista), os turnos executam a programação com saldo automático, o planejador encerra confirmando causas, e o app mostra o PPC semanal e o efetivo previsto × real.

**Architecture:** Uma migration cria `semanas`, `programacao_atividades`, `programacao_efetivo` e `semana_versoes`, adiciona `atividades.programacao_atividade_id` e coloca as regras em gatilhos e duas funções SQL (`salvar_programacao_atividade`, `encerrar_semana`). O domínio puro (`lib/dominio/programacao.ts`) calcula tudo a partir de um único formato de entrada (`DadosSemana`), que também é a foto oficial. Assim, os números ao vivo e os da foto saem da mesma função (`resumirSemana`). A camada `lib/db/programacao.ts` lê e grava. As telas ficam em `app/(app)/obras/[obraId]/programacao/`.

**Tech Stack:** Next.js App Router (versão do repo; ler `node_modules/next/dist/docs/` antes de criar rotas), Supabase (Postgres + RLS), Vitest, Playwright, Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-11-programacao-semanal-design.md`

**Ajuste à spec (decidido aqui):** a foto da semana (`semana_versoes.dados`) guarda os **dados de entrada** (`DadosSemana`), não números já calculados. O PPC, a situação e o previsto × real da semana encerrada saem de `resumirSemana(foto)`. O resultado é o mesmo que a spec pede (os números ficam congelados, porque as entradas estão congeladas), sem duplicar o cálculo em SQL. É o mesmo padrão do `foto_rdo`.

## Global Constraints

- Nunca usar `localStorage`/`sessionStorage`.
- Textos em pt-BR. Rótulos exatos: botão `"Programação"` (página da obra), `"Programar próxima semana"`, `"Programar semana"`, `"Reabrir programação"`, `"Encerrar semana"`, `"Reabrir"`, `"Trazer da programação"`; selos `"Rascunho"`, `"Programada"`, `"Aguardando encerramento"`, `"Encerrada"`; selos no turno `"Programada"` e `"Extra"`; bloco `"Fora da programação (extra)"`; quadro `"Efetivo previsto × real"`; situações `"Cumprida"`, `"Em andamento"`, `"Sem execução"`.
- Dias: `0 = segunda … 6 = domingo`. Semana de segunda a domingo, no fuso SP (`hojeSaoPaulo`, `inicioDaSemana` de `lib/dominio/analise.ts`).
- Motivo de reabertura: reaproveitar `validarMotivo`, `ERRO_MOTIVO`, `ERRO_MOTIVO_REPETIDO` (`lib/dominio/eventos.ts`); banco: 3–500 caracteres após o trim, diferente do anterior.
- Erros do banco: `errcode P0001` com a mensagem igual ao código: `semana_travada`, `turno_aberto`, `causa_pendente`, `programacao_vazia`, `atividade_com_execucao`, `programacao_incompativel`, `transicao_invalida`, `motivo_obrigatorio`, `motivo_repetido`.
- Mensagens ao usuário (spec §5), copiadas literalmente:
  - `semana_travada`: "A semana já foi programada. Reabra para editar."
  - `turno_aberto`: "Feche os turnos da semana antes de encerrar: <lista>." (lista: `dd/mm diurno`, separados por `", "`)
  - `causa_pendente`: "Informe a causa das atividades não cumpridas."
  - `programacao_vazia`: "Inclua ao menos uma atividade para programar."
  - `atividade_com_execucao`: "Esta atividade já tem execução em turnos e não pode ser apagada."
  - `programacao_incompativel`: "Esta atividade programada não vale para este turno."
  - `transicao_invalida`: "Ação não permitida para o status atual da semana."
- Funções SQL com `set search_path = ''` e nomes qualificados `public.`, no padrão das migrations existentes.
- Migration aplicada pelo SQL Editor do Supabase, guiando o usuário passo a passo: **DEV antes dos testes de integração, PROD antes do merge**. Não há psql nesta máquina.
- Testes: `npx vitest run`; integração `SUPABASE_TEST=1 npx vitest run tests/integracao`; E2E `SUPABASE_TEST=1 npx playwright test` (pré-aquecer as rotas com `page.request.get(url)`).
- Commits na branch `programacao-semanal`, com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Ao final: push da branch (prévia Vercel) → o usuário valida → merge `--no-ff` na `main` + push (Vercel produção).

## Review Focus

1. **Apagar uma obra com semana programada e executada** precisa funcionar. As travas de semana e de "atividade com execução" não podem bloquear o cascade: elas só agem enquanto a linha de `semanas` ainda existe (Task 1).
2. **Mudar a data ou o período de um turno planejado** que já tem atividade programada precisa ser recusado com `programacao_incompativel`. Sem isso, a atividade ficaria ligada a um dia não marcado (Task 1).
3. **Turno criado em dia não marcado, ou em semana em rascunho ou encerrada:** o turno é criado normalmente, sem atividades programadas e sem erro (Task 4).
4. **Apagar no turno uma atividade trazida e "Trazer da programação" de novo:** ela volta, com a sugestão recalculada pelo saldo (Task 4).
5. **URL da semana com data inválida ou que não é segunda** (`/programacao/2026-11-12`, `/programacao/xyz`): data válida redireciona para a segunda-feira da semana; data inválida dá `notFound()` (Task 5).

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20261111000000_programacao_semanal.sql` (novo) | Tabelas, coluna, gatilhos, `foto_semana`, `salvar_programacao_atividade`, `encerrar_semana`, RLS |
| `lib/dominio/programacao.ts` (novo) | Puro: tipos, datas da semana, sugestão, situação, PPC, causa sugerida, previsto × real, `resumirSemana`, status exibido |
| `lib/db/programacao.ts` (novo) | Leitura/gravação de semanas e programação; trazer da programação para o turno |
| `lib/db/mensagens.ts` | Novos códigos `ErroBanco` + `mensagemProgramacao` |
| `lib/db/atividades.ts`, `lib/db/turnos.ts` | Campo `programacao_atividade_id`; "trazer pendentes" ignora programadas; `criarTurno` traz da programação |
| `lib/dominio/analise.ts`, `lib/db/turnos.ts` | PPC das semanas programadas na análise |
| `app/(app)/obras/[obraId]/programacao/**` (novo) | Lista de semanas, rascunho, acompanhamento, encerramento, reabertura |
| `app/(app)/obras/[obraId]/page.tsx`, `turnos/[turnoId]/*`, `analise/page.tsx` | Botão, selos, "Trazer da programação", marca "sem programação" |

---

### Task 1: Migration + invariantes no banco

**Files:**
- Create: `supabase/migrations/20261111000000_programacao_semanal.sql`, `tests/integracao/programacao-banco.test.ts`

**Interfaces:**
- Produces (SQL):
  - tabelas da spec §3 (`semanas`, `programacao_atividades`, `programacao_efetivo`, `semana_versoes`, coluna `atividades.programacao_atividade_id`). A FK `atividades.programacao_atividade_id` usa o padrão `no action`, **não** `restrict` (o bloqueio de apagar é feito por gatilho; ver Review Focus 1). Há um índice único parcial `atividades_turno_programacao_uniq (turno_id, programacao_atividade_id) where programacao_atividade_id is not null`;
  - `public.foto_semana(p_semana_id uuid) returns jsonb` no formato `DadosSemana` da Task 2, com chaves em snake_case iguais às colunas: `semana`, `atividades[]` (com `equipe[]`), `execucoes[]` (atividades de turno ligadas, com `turno_id`, `data`, `periodo`, `status_turno`, `qtd_planejada`, `qtd_realizada`, `causa`), `turnos[]` (turnos da obra com data na semana, com horários, `efetivo[]` e `extras[]` = atividades sem ligação). Só `service_role` executa;
  - `public.salvar_programacao_atividade(p_semana_id uuid, p_id uuid, p_dados jsonb) returns uuid`: `security invoker`. Insere se `p_id` for null, senão atualiza. Substitui a equipe inteira (`p_dados.equipe`) na mesma transação. Grant para `authenticated`;
  - `public.encerrar_semana(p_semana_id uuid, p_causas jsonb) returns void`: `security invoker`. `p_causas` = `{ "<programacao_atividade_id>": "<causa>" }`. Grava as causas e depois o `status = 'encerrada'`. Grant para `authenticated`;
  - gatilhos 1–7 da spec §3, mais o gatilho **8**: update de `data`, `periodo` ou `obra_id` em `turnos` com atividade ligada → `programacao_incompativel`.

- [ ] **Step 1: Escrever a migration.** Detalhes que a spec não fixa:
  - **Trava (gatilho 1)** em `programacao_atividades` e `programacao_efetivo`, before insert/update/delete. Busca a semana; **se ela não existe mais (cascade), deixa passar**. Em `programada`, aceita somente o update em que só a coluna `causa` muda. Em `encerrada`, recusa tudo. Em `rascunho`, recusa `causa` não nula.
  - **Apagar com execução (gatilho 6):** before delete em `programacao_atividades`. Se a semana ainda existe e há atividade ligada → `atividade_com_execucao`.
  - **Transições (gatilhos 2–4):** before update of status em `semanas`. Permitidas: `rascunho→programada`, `programada→encerrada`, `programada→rascunho`, `encerrada→programada`; o resto → `transicao_invalida`. Na reabertura, o motivo segue a lógica de `tg_exigir_motivo_reabertura`. Ao programar, grava `programada_em = now()`. Ao encerrar, grava `encerrada_em = now()`. Ao ir para `rascunho`, grava `programada_em = null`; ao voltar para `programada` a partir de `encerrada`, grava `encerrada_em = null`.
  - **Cumprida no SQL (gatilho 3):** `coalesce(sum(qtd_realizada), 0) >= meta` sobre as atividades ligadas.
  - **Ligação (gatilho 5):** before insert/update of `programacao_atividade_id, turno_id` em `atividades`. Turno da mesma obra da semana, `data` entre `inicio` e `inicio + 6`, `(data - inicio)` contido em `dias`, e o mesmo `periodo`.
  - **Versões (gatilho 7):** `after update of status` em `semanas`, `security definer`, quando o status novo é `programada` ou `encerrada` **e** o antigo é diferente. Emite `numero = max + 1`, `evento = new.status` e `dados = foto_semana(new.id)`.
  - **Validação de `dias`:** função imutável `public.dias_validos(smallint[])`: não vazio, valores de 0 a 6, sem repetição.
  - Triggers `updated_at` e índices em todas as FKs. RLS no padrão de `atividades_all`/`efetivo_all` (`eh_membro` via `obras`). `semana_versoes`: somente select, igual a `rdo_versoes`.
- [ ] **Step 2: Guiar o usuário a aplicar a migration no Supabase DEV** (SQL Editor) e confirmar "Success. No rows returned".
- [ ] **Step 3: Escrever `tests/integracao/programacao-banco.test.ts`** (padrão de `turno-eventos.test.ts`, uma obra própria por teste, semana `inicio = "2026-11-09"`, inserts diretos pelo `u.cliente`). Testes, com o código esperado em `error.message`:
  - `"programar sem atividade"` → `programacao_vazia`;
  - `"semana programada trava atividades e equipe"`: insert, update da descrição e delete de equipe → `semana_travada`. Update só de `causa` → aceito;
  - `"causa em rascunho"` → `semana_travada`;
  - `"rascunho direto para encerrada"` → `transicao_invalida`;
  - `"reabrir sem motivo e com motivo repetido"` → `motivo_obrigatorio`, depois `motivo_repetido` (motivo repetido com espaços em volta);
  - `"encerrar com turno aberto"` → `turno_aberto`; `"encerrar sem causa da não cumprida"` → `causa_pendente`; `encerrar_semana` com a causa → aceito, `status = 'encerrada'`;
  - `"versões ao programar e encerrar"`: duas linhas em `semana_versoes` (`numero` 1 e 2, `evento` programada/encerrada), e `dados.atividades[0].equipe` presente;
  - `"ligação fora do dia, do período ou da obra"` → `programacao_incompativel` (três casos);
  - `"mudar data de turno com atividade programada"` → `programacao_incompativel` (Review Focus 2);
  - `"apagar atividade programada com execução"`: reabrir para rascunho e então apagar → `atividade_com_execucao`;
  - `"apagar a obra com semana executada"`: delete da obra pelo cliente admin funciona, e `semanas` dessa obra fica vazia (Review Focus 1);
  - `"outra empresa não vê a semana"`: com o cliente de `outro`, o select retorna vazio.
- [ ] **Step 4: Rodar** `SUPABASE_TEST=1 npx vitest run tests/integracao/programacao-banco.test.ts`. Esperado: tudo passa. Se algo falhar, corrigir a migration, reaplicar no DEV (`create or replace` / `drop trigger if exists`) e rodar de novo.
- [ ] **Step 5: Commit** `feat(programacao): migration com semanas, travas e versões`.

### Task 2: Domínio puro

**Files:**
- Create: `lib/dominio/programacao.ts`, `tests/dominio/programacao.test.ts`

**Interfaces:**
- Consumes: `inicioDaSemana` (`lib/dominio/analise.ts`), `hhTurno` (`lib/dominio/calculos.ts`), `Causa`, `Periodo`, `StatusTurno` (`lib/dominio/tipos.ts`).
- Produces:
```ts
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type StatusSemana = "rascunho" | "programada" | "encerrada";
export type StatusExibido = StatusSemana | "aguardando_encerramento";
export type Situacao = "cumprida" | "em_andamento" | "sem_execucao";
export type EquipePrevista = { funcao: string; quantidade: number };
export type Semana = { id: string; obra_id: string; inicio: string; status: StatusSemana;
  programada_em: string | null; encerrada_em: string | null; motivo_reabertura: string | null };
export type AtividadeProgramada = { id: string; ordem: number; descricao: string; local: string | null;
  unidade: string | null; meta: number; dias: DiaSemana[]; periodo: Periodo; causa: Causa | null; equipe: EquipePrevista[] };
export type ExecucaoLigada = { id: string; programacao_atividade_id: string; turno_id: string; data: string;
  periodo: Periodo; status_turno: StatusTurno; qtd_planejada: number; qtd_realizada: number | null; causa: Causa | null };
export type TurnoDaSemana = { id: string; data: string; periodo: Periodo; status: StatusTurno;
  hora_inicio_prevista: string | null; hora_fim_prevista: string | null; hora_inicio_real: string | null; hora_fim_real: string | null;
  efetivo: EquipePrevista[]; extras: { id: string; descricao: string; unidade: string | null; qtd_planejada: number; qtd_realizada: number | null }[] };
export type DadosSemana = { semana: Semana; atividades: AtividadeProgramada[]; execucoes: ExecucaoLigada[]; turnos: TurnoDaSemana[] };
export type PpcSemanal = { cumpridas: number; total: number; ppc: number | null };
export type LinhaFuncao = { funcao: string; previsto: number; real: number | null; diferenca: number | null };
export type BlocoPrevistoReal = { data: string; periodo: Periodo; semTurno: boolean; funcoes: LinhaFuncao[];
  hhPrevisto: number | null; hhReal: number | null };
export type AtividadeResumida = AtividadeProgramada & { realizado: number; saldo: number; situacao: Situacao; causaSugerida: Causa | null };
export type ResumoSemana = { atividades: AtividadeResumida[]; ppc: PpcSemanal; extras: (TurnoDaSemana["extras"][number] & { data: string; periodo: Periodo })[];
  previstoReal: BlocoPrevistoReal[] };

export function dataDoDia(inicio: string, dia: DiaSemana): string;
export function diaDaSemana(inicio: string, data: string): DiaSemana | null; // null fora da semana
export function realizadoAte(execucoes: ExecucaoLigada[], programacaoId: string, statusValidos?: StatusTurno[]): number;
export function sugestaoDoDia(a: Pick<AtividadeProgramada, "meta" | "dias">, dia: DiaSemana, realizado: number): number | null;
export function situacaoAtividade(meta: number, realizado: number): Situacao;
export function ppcSemanal(itens: { meta: number; realizado: number }[]): PpcSemanal;
export function causaSugerida(execucoes: ExecucaoLigada[]): Causa | null;
export function normalizarFuncao(texto: string): string;
export function efetivoPrevistoReal(d: DadosSemana): BlocoPrevistoReal[];
export function resumirSemana(d: DadosSemana): ResumoSemana;
export function statusExibido(status: StatusSemana, inicio: string, hoje: string): StatusExibido;
export function encerramentoLiberado(atividades: Pick<AtividadeProgramada, "dias">[], inicio: string, hoje: string): boolean;
export function rotuloTurnosAbertos(turnos: Pick<TurnoDaSemana, "data" | "periodo" | "status">[]): string | null; // "10/11 diurno, 11/11 noturno" ou null
export const ROTULO_STATUS_SEMANA: Record<StatusExibido, string>;
export const ROTULO_SITUACAO: Record<Situacao, string>;
```

- [ ] **Step 1: Escrever os testes que falham** em `tests/dominio/programacao.test.ts`:
  - `sugestaoDoDia`: `{meta:120, dias:[0,1,2]}`. Dia 0 com realizado 0 → `40`. Dia 1 com realizado 30 → `40`. Dia 2 (último) com realizado 70 → `50`. Dia 3 → `null`. Realizado 120 → `null`. `{meta:10, dias:[0,1,2]}` no dia 0 → `3.33`. `{meta:100, dias:[0,1]}` com realizado 90 no dia 0 → `10` (limitado ao saldo);
  - `realizadoAte`: `null` conta 0. Sem `statusValidos`, conta todos os status; com `["enviado","fechado"]`, ignora `planejado`/`em_campo`;
  - `situacaoAtividade(10, 0)` → `"sem_execucao"`; `(10, 4)` → `"em_andamento"`; `(10, 10)` e `(10, 12)` → `"cumprida"`;
  - `ppcSemanal([{meta:10,realizado:10},{meta:5,realizado:1}])` → `{cumpridas:1,total:2,ppc:0.5}`; `[]` → `ppc: null`;
  - `causaSugerida`: execuções de 10/11 diurno (`material`), 10/11 noturno (`clima`) e 11/11 diurno (`null`) → `"clima"`. Todas nulas → `null`;
  - `normalizarFuncao("  Caldeirêiro   Montador ")` → `"caldeireiro montador"`;
  - `efetivoPrevistoReal`: duas atividades em 10/11 diurno (equipes `Caldeireiro 2` e `caldeireiro 1` + `Ajudante 2`), turno 10/11 diurno das 07:00 às 17:00 com efetivo `Caldeireiro 2` e `Soldador 1`. Esperado no bloco: Caldeireiro previsto 3 / real 2 / diferença −1; Ajudante 2/0/−2; Soldador 0/1/+1; `hhPrevisto = 50`, `hhReal = 30`. Um dia marcado sem turno → `semTurno: true`, `real: null`, `diferenca: null`, `hhReal: null`, `hhPrevisto: null`. A ordem dos blocos é por data, com diurno antes de noturno. O rótulo da função é o primeiro texto original (`"Caldeireiro"`);
  - `resumirSemana`: as extras saem de `turnos[].extras`, com data e período, e não entram no `ppc`. O `realizado` de cada atividade conta **só** turnos `enviado`/`fechado`;
  - `statusExibido("programada", "2026-11-09", "2026-11-16")` → `"aguardando_encerramento"`; com hoje `"2026-11-15"` → `"programada"`; `"encerrada"` → `"encerrada"`;
  - `encerramentoLiberado([{dias:[0,2]}], "2026-11-09", "2026-11-10")` → `false`; com `"2026-11-11"` → `true`;
  - `diaDaSemana("2026-11-09", "2026-11-15")` → `6`; `"2026-11-16"` → `null`.
- [ ] **Step 2: Rodar** `npx vitest run tests/dominio/programacao.test.ts`. Esperado: FAIL (módulo inexistente).
- [ ] **Step 3: Implementar `lib/dominio/programacao.ts`.**
  - Arredondamento da sugestão: `Math.round(x * 100) / 100`.
  - `normalizarFuncao`: `normalize("NFD")`, remove `\p{Diacritic}`, aplica trim e minúsculas, e colapsa `\s+`.
  - Os blocos de `efetivoPrevistoReal` são a união de (dias marcados × período das atividades) com os turnos existentes da semana.
  - Horas e HH: `hhTurno` com `[{quantidade: totalPrevisto}]` e com o efetivo real.
- [ ] **Step 4: Rodar** de novo. Esperado: PASS. Rodar também `npx vitest run tests/dominio`: nada mais quebra.
- [ ] **Step 5: Commit** `feat(programacao): domínio puro (sugestão, PPC semanal, previsto × real)`.

### Task 3: Camada de dados da semana

**Files:**
- Create: `lib/db/programacao.ts`, `tests/integracao/programacao.test.ts`
- Modify: `lib/db/mensagens.ts`

**Interfaces:**
- Consumes: tipos e funções da Task 2; `validarMotivo`; `Resultado`/`ok`/`falha`; `LIMITES`, `QTD_PLANEJADA_MAX`, `causaValida`, `errosDeTamanho`, `falhaCampos` (`lib/db/validacao.ts`).
- Produces:
```ts
// mensagens.ts
ErroBanco += "semana_travada" | "turno_aberto" | "programacao_vazia" | "atividade_com_execucao"
           | "programacao_incompativel" | "transicao_invalida";
export function mensagemProgramacao(error: { code?: string; message?: string } | null | undefined, padrao: string): string;
// programacao.ts
export type EntradaAtividadeProgramada = { descricao: string; local?: string | null; unidade?: string | null;
  meta: number; dias: DiaSemana[]; periodo: Periodo; equipe: EquipePrevista[] };
export async function obterSemana(c, obraId: string, inicio: string): Promise<Semana | null>;
export async function criarRascunho(c, obraId: string, data: string): Promise<Resultado<Semana>>; // converte para a segunda; idempotente
export async function obterDadosSemana(c, semana: Semana): Promise<DadosSemana>;               // ao vivo
export async function dadosOficiais(c, semana: Semana): Promise<DadosSemana>;                  // encerrada → última foto; senão ao vivo
export async function listarSemanasComResumo(c, obraId: string): Promise<{ semana: Semana; ppc: PpcSemanal | null }[]>; // inicio desc; rascunho → null
export async function salvarAtividadeProgramada(c, semanaId: string, dados: EntradaAtividadeProgramada, id?: string): Promise<Resultado<{ id: string }>>;
export async function removerAtividadeProgramada(c, id: string): Promise<Resultado>;
export async function programarSemana(c, semanaId: string): Promise<Resultado>;
export async function encerrarSemana(c, semana: Semana, causas: Record<string, Causa>): Promise<Resultado>;
export async function reabrirSemana(c, semanaId: string, motivo: unknown): Promise<Resultado>;
```

- [ ] **Step 1: Escrever os testes que falham** em `tests/integracao/programacao.test.ts`:
  - `criarRascunho(c, obra, "2026-11-12")` → `inicio "2026-11-09"`; uma segunda chamada devolve o mesmo `id`;
  - `salvarAtividadeProgramada` com equipe de 2 linhas, depois uma segunda gravação com 1 linha → `obterDadosSemana` mostra 1 linha. Meta `0` → falha com o campo `meta`. `dias: []` → falha com o campo `dias`;
  - `programarSemana` em semana vazia → `"Inclua ao menos uma atividade para programar."`; com atividade → ok, e `salvarAtividadeProgramada` depois → `"A semana já foi programada. Reabra para editar."`;
  - `encerrarSemana` com turno da semana não fechado (`10/11` diurno) → `"Feche os turnos da semana antes de encerrar: 10/11 diurno."`; sem a causa → `"Informe a causa das atividades não cumpridas."`; completo → ok;
  - `dadosOficiais` da semana encerrada é igual à foto: alterar a meta via admin depois do encerramento não muda `resumirSemana(dadosOficiais(...)).atividades[0].meta`;
  - `reabrirSemana(c, id, "  ")` → `ERRO_MOTIVO`; o motivo repetido → `ERRO_MOTIVO_REPETIDO`;
  - `removerAtividadeProgramada` com execução → `"Esta atividade já tem execução em turnos e não pode ser apagada."`.
- [ ] **Step 2: Rodar** `SUPABASE_TEST=1 npx vitest run tests/integracao/programacao.test.ts`. Esperado: FAIL (módulo inexistente).
- [ ] **Step 3: Implementar.**
  - `salvarAtividadeProgramada`: valida no app (descrição obrigatória e limites de `LIMITES`; meta > 0 e ≤ `QTD_PLANEJADA_MAX`; dias válidos; período; equipe com função não vazia e quantidade inteira > 0) e chama `rpc("salvar_programacao_atividade")`.
  - `encerrarSemana`: pré-checa com `rotuloTurnosAbertos` sobre `obterDadosSemana`, para montar a lista na mensagem, e então chama `rpc("encerrar_semana")`.
  - `dadosOficiais`: lê a foto pelo cliente do usuário (RLS de select) e converte números (`meta`, qtds) com `Number`.
  - Todo erro do banco passa por `mensagemProgramacao`.
- [ ] **Step 4: Rodar** de novo. Esperado: PASS.
- [ ] **Step 5: Commit** `feat(programacao): camada de dados da semana`.

### Task 4: Programação chega ao turno

**Files:**
- Modify: `lib/db/atividades.ts` (tipo `Atividade`, `COLUNAS`, `normalizarAtividade`, `trazerPendentes`), `lib/db/turnos.ts` (`criarTurno`), `lib/db/programacao.ts`
- Test: `tests/integracao/programacao-turno.test.ts`

**Interfaces:**
- Consumes: `sugestaoDoDia`, `realizadoAte`, `diaDaSemana`, `inicioDaSemana`; `obterSemana`, `obterDadosSemana`.
- Produces:
```ts
// atividades.ts
Atividade.programacao_atividade_id: string | null
// programacao.ts
export async function trazerDaProgramacao(c, turnoId: string): Promise<Resultado<{ adicionadas: number }>>;
export async function semanaDoTurno(c, obraId: string, data: string): Promise<Semana | null>;
```

- [ ] **Step 1: Escrever os testes que falham:**
  - `"criar turno na terça traz a atividade com sugestão"`: semana programada com `{meta:120, dias:[0,1,2], periodo:"diurno"}` e turno de segunda com realizado 30 (via `salvarExecucaoPlanejador`). `criarTurno` de 10/11 diurno → 1 atividade, com `qtd_planejada 40` e o `programacao_atividade_id` certo;
  - `"turno noturno, dia não marcado, semana em rascunho ou encerrada não trazem nada"`: o turno é criado e tem 0 atividades (Review Focus 3);
  - `"trazer da programação é idempotente"`: duas chamadas → `adicionadas` 1 e depois 0;
  - `"apagar no turno e trazer de novo"`: `removerAtividade` e depois `trazerDaProgramacao` → `adicionadas: 1` (Review Focus 4);
  - `"trazer pendentes ignora atividade programada"`: turno anterior com a programada parcial → `trazerPendentes` não a copia.
- [ ] **Step 2: Rodar** `SUPABASE_TEST=1 npx vitest run tests/integracao/programacao-turno.test.ts`. Esperado: FAIL.
- [ ] **Step 3: Implementar.**
  - `trazerDaProgramacao`: usa o mesmo `turnoEditavel` de `trazerPendentes` (exportar de `atividades.ts`). Se a semana não estiver `programada`, devolve `ok({adicionadas:0})`. Considera as atividades com o período do turno, cujo dia está marcado e que ainda não estão no turno. Calcula `sugestaoDoDia` com o realizado **de todos os status** dos *outros* turnos e pula o que der `null`. Insere com `ordem` depois da maior existente; em `23505`, insere uma a uma (igual a `trazerPendentes`).
  - `criarTurno`: depois do insert, chama `trazerDaProgramacao`. Se falhar, só faz `console.error` e devolve o turno mesmo assim.
  - `trazerPendentes`: filtra `programacao_atividade_id === null`.
- [ ] **Step 4: Rodar** este arquivo e toda a integração existente (`SUPABASE_TEST=1 npx vitest run tests/integracao`). Esperado: PASS.
- [ ] **Step 5: Commit** `feat(programacao): turno traz as atividades programadas do dia`.

### Task 5: Telas da programação (lista e rascunho)

**Files:**
- Create: `app/(app)/obras/[obraId]/programacao/page.tsx`, `programacao/acoes.ts`, `programacao/[inicio]/page.tsx`, `[inicio]/acoes.ts`, `[inicio]/FormAtividadeProgramada.tsx`, `[inicio]/ListaRascunho.tsx`
- Modify: `app/(app)/obras/[obraId]/page.tsx` (botão "Programação", secundário, antes de "RDOs")

**Interfaces:**
- Consumes: Task 3 (`listarSemanasComResumo`, `criarRascunho`, `obterSemana`, `dadosOficiais`, `salvarAtividadeProgramada`, `removerAtividadeProgramada`, `programarSemana`); Task 2 (`statusExibido`, `ROTULO_STATUS_SEMANA`, `inicioDaSemana`, `sugestaoDoDia`); `FUNCOES_SUGERIDAS`; componentes `Cartao`, `Selo`, `Botao`, `Aviso`, `Campo`.
- Produces: rota `/obras/[obraId]/programacao/[inicio]`. O `page.tsx` decide o conteúdo pelo status: `rascunho` → `ListaRascunho`; demais → `Acompanhamento` (Task 6; até lá, um placeholder com o texto "Semana programada").

- [ ] **Step 1: Ler** em `node_modules/next/dist/docs/` as páginas de `params`/`searchParams` assíncronos, `redirect`, `notFound` e server actions, e seguir o padrão de `turnos/novo` (`useActionState`, `redirect` na action).
- [ ] **Step 2: Implementar.**
  - **Lista:** cada linha é um link com `dd/mm`, o selo (`statusExibido` com `hojeSaoPaulo()`) e o PPC (`formatarPercentual` + `"— N de M"`; `"provisório"` se não encerrada; rascunho `"—"`).
  - **Criação:** "Programar próxima semana" (`criarRascunho` com hoje + 7) e um formulário com `input type="date"` + "Abrir semana". Os dois redirecionam para `/programacao/<inicio>`.
  - **Página da semana:** valida `inicio` com `/^\d{4}-\d{2}-\d{2}$/` e uma data real; data inválida → `notFound()`; se `inicioDaSemana(inicio) !== inicio` → `redirect` para a segunda-feira (Review Focus 5). Semana inexistente na obra → a página oferece "Criar rascunho desta semana".
  - **`FormAtividadeProgramada`:**
    - campos descrição, local, unidade e meta;
    - os dias são 7 checkboxes estilizados como chips, com `name="dias"` e rótulos `Seg Ter Qua Qui Sex Sáb Dom`;
    - período diurno/noturno, padrão diurno;
    - equipe com linhas função (com `datalist` de `FUNCOES_SUGERIDAS`) + quantidade, com "Adicionar função" e "Remover";
    - prévia `"≈ 40 un/dia"` calculada no cliente com `sugestaoDoDia(…, primeiroDia, 0)`.
    - Serve para criar e para editar.
  - **`ListaRascunho`:** atividades com resumo (meta, dias, período, equipe), "Editar", "Apagar", o formulário de nova atividade e o botão "Programar semana" (erros via `Aviso`).
- [ ] **Step 3: Verificar** com `npx tsc --noEmit` e `npm run lint` (sem erros). Depois, `npm run dev`: criar uma obra, abrir "Programação", criar a próxima semana, incluir uma atividade com 2 funções, editar, programar; e `/programacao/2026-11-12` redireciona para `/2026-11-09`.
- [ ] **Step 4: Commit** `feat(programacao): lista de semanas e montagem do rascunho`.

### Task 6: Acompanhamento, encerramento e reabertura

**Files:**
- Create: `app/(app)/obras/[obraId]/programacao/[inicio]/Acompanhamento.tsx`, `[inicio]/PrevistoReal.tsx`, `[inicio]/FormEncerrar.tsx`, `[inicio]/FormReabrir.tsx`
- Modify: `[inicio]/page.tsx`, `[inicio]/acoes.ts`

**Interfaces:**
- Consumes: `resumirSemana`, `encerramentoLiberado`, `ROTULO_SITUACAO`, `CAUSAS`; `encerrarSemana`, `reabrirSemana`, `dadosOficiais`; `Barra`, `Expansivel`.

- [ ] **Step 1: Implementar.**
  - **`Acompanhamento`:** cabeçalho com o PPC (`"70% — 7 de 10"` + `"provisório"` se não encerrada) e `"+N fora da programação"`. Por atividade: meta, realizado, saldo (com a unidade, via `numeroBR`) e um `Selo` com a situação (cumprida = sucesso, em andamento = alerta, sem execução = neutro). Na semana encerrada, também a causa (`CAUSAS[causa]`). Em seguida, o bloco `"Fora da programação (extra)"` (data, período, descrição, planejado/realizado) e o `PrevistoReal`.
  - **`PrevistoReal`:** um `Expansivel` por bloco (`"Ter 10/11 · Diurno"`), com uma tabela função | previsto | real | diferença (diferença com sinal, cor de alerta se negativa). Linha final com o HH previsto e o HH real. Quando `semTurno`, mostra `"sem turno"` no lugar do real.
  - **`FormEncerrar`:** aparece quando a semana está `programada` e `encerramentoLiberado`. Mostra um `select` de causa por atividade não cumprida, pré-selecionado com `causaSugerida`, e o botão "Encerrar semana".
  - **`FormReabrir`:** `textarea` de motivo, no padrão do formulário de reabertura do turno em `AcoesTurno.tsx`. Rótulo do botão: `"Reabrir programação"` (programada) ou `"Reabrir"` (encerrada).
  - As actions chamam a Task 3, fazem `revalidatePath` da página e da lista e devolvem erros via `Aviso`.
- [ ] **Step 2: Verificar** com `npx tsc --noEmit` e `npm run lint`. Depois, `npm run dev`: na semana programada, criar o turno de um dia marcado, lançar o realizado, fechar e encerrar com causa. Ver o PPC final; reabrir sem motivo (erro) e com motivo (volta para programada).
- [ ] **Step 3: Commit** `feat(programacao): acompanhamento, previsto × real, encerrar e reabrir`.

### Task 7: Turno — selos e "Trazer da programação"

**Files:**
- Modify: `app/(app)/obras/[obraId]/turnos/[turnoId]/page.tsx`, `ItemAtividade.tsx`, `ListaAtividades.tsx`, `acoes.ts`

**Interfaces:**
- Consumes: `semanaDoTurno`, `trazerDaProgramacao`; `Atividade.programacao_atividade_id`.

- [ ] **Step 1: Implementar.**
  - A `page.tsx` busca `semanaDoTurno(obraId, turno.data)` e passa `semanaStatus: StatusSemana | null` para a lista.
  - `ItemAtividade`: selo `"Programada"` (tom info) se `programacao_atividade_id`; selo `"Extra"` (tom alerta) se não tem ligação **e** `semanaStatus` é `programada` ou `encerrada`.
  - `ListaAtividades`: botão `"Trazer da programação"` (secundário, ao lado de "Trazer pendentes", mesma condição de exibição) quando `semanaStatus === "programada"`. Usa a action nova `trazerDaProgramacaoAcao`, com as mensagens `"N atividade(s) trazida(s) da programação"` e `"Nada a trazer da programação"`.
- [ ] **Step 2: Verificar** com `npx tsc --noEmit`, `npm run lint` e `npx vitest run`. Depois, `npm run dev`: o turno da semana programada mostra os selos, e o botão traz a atividade apagada.
- [ ] **Step 3: Commit** `feat(programacao): selos e trazer da programação no turno`.

### Task 8: Análise usa a programação

**Files:**
- Modify: `lib/dominio/analise.ts`, `tests/dominio/analise.test.ts`, `app/(app)/obras/[obraId]/analise/page.tsx`, `lib/db/programacao.ts`

**Interfaces:**
- Consumes: `resumirSemana`, `dadosOficiais`.
- Produces:
```ts
export type SemanaProgramadaAnalise = { inicio: string; encerrada: boolean; cumpridas: number; total: number;
  naoCumpridas: { descricao: string; causa: Causa | null }[] }; // causa: confirmada (encerrada) ou sugerida
export function analisarObra(turnos: TurnoAnalise[], semanas: string[], programadas?: SemanaProgramadaAnalise[]): Analise;
// SemanaAnalise ganha: programada: boolean; provisorio: boolean
// CausaAnalise.atividades[i] vira união:
//   { origem: "turno"; turnoId; data; periodo; descricao; observacao } | { origem: "semana"; semanaInicio: string; descricao: string }
// lib/db/programacao.ts:
export async function listarProgramadasParaAnalise(c, obraId: string, desde: string): Promise<SemanaProgramadaAnalise[]>;
```

- [ ] **Step 1: Escrever os testes que falham** em `tests/dominio/analise.test.ts`:
  - uma semana com `programadas` usa `cumpridas/total` dela e ignora os turnos daquela semana no PPC e nas causas, mas mantém a lista `turnos` para o detalhe; `programada: true`, `provisorio` = `!encerrada`;
  - as semanas sem programação mantêm o cálculo atual, com `programada: false`;
  - o PPC do período soma as duas fontes;
  - uma causa de semana programada entra no ranking com `origem: "semana"`; uma não cumprida sem causa (provisória) não entra;
  - os testes atuais continuam passando (`programadas` omitido = comportamento atual; causa de turno com `origem: "turno"`).
- [ ] **Step 2: Rodar** `npx vitest run tests/dominio/analise.test.ts`. Esperado: FAIL.
- [ ] **Step 3: Implementar** a análise e `listarProgramadasParaAnalise` (semanas `programada`/`encerrada` com `inicio >= desde`, via `dadosOficiais` + `resumirSemana`). Na página: o selo `"sem programação"` (neutro) nas semanas não programadas que têm turnos, `"provisório"` nas programadas não encerradas, e o link da causa de origem semana para `/programacao/<inicio>`.
- [ ] **Step 4: Rodar** `npx vitest run`, `npx tsc --noEmit` e `npm run lint`. Esperado: PASS.
- [ ] **Step 5: Commit** `feat(analise): PPC semanal da programação`.

### Task 9: E2E, revisão e publicação

**Files:**
- Create: `tests/e2e/programacao.spec.ts`

- [ ] **Step 1: Escrever o E2E** (padrão de `ciclo-turno.spec.ts`, com `prepararUsuario`).
  - Usa a **semana atual**, porque o encerramento só é liberado a partir do último dia marcado. A sugestão em vários dias já é coberta pela integração da Task 4.
  - Login → obra → "Programação" → "Abrir semana" com a data de hoje (`hojeSaoPaulo`) → rascunho.
  - Uma atividade com meta 10, apenas o chip do dia de hoje marcado, equipe `Caldeireiro 2` → "Programar semana".
  - Criar o turno de hoje (diurno) → a atividade aparece com o selo "Programada" e quantidade `10` (último dia = saldo).
  - Lançar o realizado `3` com causa "Material" e o horário real; liberar/enviar/fechar como em `ciclo-turno`.
  - Na semana: `"Encerrar semana"` com a causa pré-selecionada "Material" → `"0% — 0 de 1"`, sem "provisório"; o quadro previsto × real mostra Caldeireiro previsto 2.
  - Na análise, a semana atual mostra `0%`.
  - Pré-aquecer cada rota com `page.request.get`.
- [ ] **Step 2: Rodar** `SUPABASE_TEST=1 npx playwright test`. Esperado: os dois specs passam.
- [ ] **Step 3: Rodar a suíte completa** (`npx vitest run`, `SUPABASE_TEST=1 npx vitest run tests/integracao`, `npx tsc --noEmit`, `npm run lint`, `npm run build`). Esperado: tudo verde.
- [ ] **Step 4: Commit** `test(e2e): ciclo da programação semanal`.
- [ ] **Step 5: Revisão final** do branch inteiro por um subagente revisor (opus); corrigir o que for confirmado, com um commit por correção.
- [ ] **Step 6: Push** da branch `programacao-semanal` (prévia Vercel) e passar o link ao usuário para validação.
- [ ] **Step 7: Depois do ok do usuário:** guiá-lo a aplicar a migration no Supabase **PROD** (SQL Editor). Depois, `git checkout main && git merge --no-ff programacao-semanal && git push`, conferir o deploy de produção no Vercel e atualizar a memória do roadmap.
