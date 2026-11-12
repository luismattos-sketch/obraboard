# Quadro de check-in / check-out — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada atividade, atividade programada e linha de efetivo ganha um "Responsável" opcional. O turno é exibido num quadro só leitura, organizado por responsável (visões de check-in e de check-out), para o planejador, a TV e o gestor. O link de campo filtra a tela pelo responsável escolhido, e uma foto oficial do check-in é gravada ao liberar o turno.

**Architecture:** Uma migration cria `responsaveis` e `checkin_fotos`, adiciona as colunas `responsavel_id`, `lancado_por_id` e `obras.quadro_token_hash`, troca `substituir_efetivo` por uma versão **sempre escopada por equipe** e grava a foto por gatilho. O domínio puro (`lib/dominio/quadro.ts`) transforma um único formato de entrada (`EntradaQuadro`) no modelo do quadro. A foto do check-in guarda exatamente esse formato, então o quadro ao vivo e a foto saem da mesma função (`montarQuadro`). `lib/db/quadro.ts` lê os dados para três entradas: o planejador, o link público e a foto. Um único componente de servidor (`components/quadro/Quadro.tsx`) desenha o quadro.

**Tech Stack:** Next.js App Router da versão do repo (ler `node_modules/next/dist/docs/` antes de criar rotas e antes de usar `router.refresh`), Supabase (Postgres + RLS), Vitest, Playwright, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-11-11-quadro-checkin-checkout-design.md`

**Ajustes à spec (decididos aqui):**
1. **Efetivo:** o efetivo é salvo **sempre por equipe**, também pelo planejador, já que a tela agora é agrupada. `substituir_efetivo(p_turno_id, p_responsavel_id, p_esperado, p_linhas)` substitui só as linhas daquele `responsavel_id`, e `null` quer dizer a equipe "Sem responsável". A função antiga, de 3 argumentos, é removida. É o mesmo resultado que a spec pede, com um único caminho de código.
2. **Efetivo no check-in:** o efetivo passa a ser editável também com o turno `planejado`, porque o efetivo presente é informado no check-in. Hoje o bloco só aparece depois da liberação.
3. **Formato da foto:** a foto do check-in guarda `EntradaQuadro` (os dados de entrada, com os nomes dos responsáveis resolvidos), e não as equipes já agrupadas. O agrupamento sai de `montarQuadro`, como no padrão `foto_rdo` / `foto_semana`. Tudo o que a spec pede na seção 1 está nesse formato.

## Global Constraints

- Nunca usar `localStorage`/`sessionStorage`. A escolha do responsável no link fica na URL (`?r=`), e a visão do quadro também (`?visao=`, `?turno=`).
- No app o termo é **"Responsável"**, nunca "encarregado". No código o nome é `responsavel`.
- Textos exatos: seção `"Responsáveis"`; menu `"Responsável"`, opções `"Sem responsável"` e `"+ Novo responsável…"`; faixa `"Sem responsável"`; nome inativo `"<Nome> (inativo)"`; bloco `"Link do quadro (TV / gestor)"`, botões `"Gerar link"`, `"Copiar"`, `"Abrir"`, `"Gerar novo link"` (confirmação `"O link atual vai parar de funcionar"`); botões `"Ver quadro"`, `"Editar"`, `"Agora"`; seletor `"Check-in"` / `"Check-out"`; selos `"CHECK-IN"`, `"CHECK-OUT"`, `"Turno fechado"`, `"EXTRA"`; liberação `"Ao liberar, o check-in fica registrado."`; linha do tempo `"Check-in registrado"`; avisos `"Sem turno hoje — mostrando <dd/mm> <período>"`, `"Nenhum turno ainda"`, `"Check-in sem registro oficial"`, `"Link desativado. Peça o link novo ao planejador."`; link de campo `"Quem é você?"`, `"Ver tudo"`, `"Lançando como <Nome> · Trocar"`, `"Terminou? Avise o planejador."`; rascunho `"N atividades sem responsável"` (`"1 atividade sem responsável"` no singular).
- Resumo da equipe: `"x de y programadas · z%"` mais `"+N extra"`. Se o turno não tem nenhuma atividade programada: `"x de y concluídas · z%"`.
- Erros do banco (`P0001`, mensagem = código): `responsavel_invalido` → "Responsável inválido para esta obra."; nome duplicado (unicidade `23505` em `responsaveis_obra_nome_uniq`) → "Já existe um responsável com esse nome nesta obra."; falha ao liberar → "Não foi possível liberar o turno. Tente de novo."
- Funções SQL com `set search_path = ''` e nomes qualificados `public.`.
- Migration aplicada pelo SQL Editor do Supabase, guiando o usuário passo a passo: **DEV antes dos testes de integração, PROD antes do merge**. Não há psql nesta máquina.
- Testes **pelo PowerShell** (no Git Bash todos falham por erro de config): `npx vitest run`; integração `$env:SUPABASE_TEST='1'; npx vitest run tests/integracao`; E2E `$env:SUPABASE_TEST='1'; npx playwright test` (pré-aquecer rotas com `page.request.get(url)`).
- Commits na branch `quadro-checkin` com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Ao final: push da branch (prévia Vercel) → o usuário valida → merge `--no-ff` na `main` + push (Vercel produção).

## Review Focus

1. **Turnos e semanas antigos sem nenhum responsável:** a tela do turno, o link de campo (vai direto para a lista), o quadro (uma faixa só, "Sem responsável") e o RDO funcionam como antes (Tasks 5, 7 e 8).
2. **Efetivo antigo após a migration:** as linhas existentes ficam com `responsavel_id = null` e precisam continuar editáveis pela equipe "Sem responsável" sem gerar `efetivo_conflito` (Task 1, teste `"efetivo legado"`).
3. **Responsável desativado** que já está numa atividade: continua aparecendo como "(inativo)" no menu, no quadro e no link de campo, mas não aparece para escolha nova (Tasks 3 e 8).
4. **`?r=` adulterado no link de campo** (id de outra obra, de outro turno ou texto qualquer): volta para "Quem é você?" e nunca grava atividade de outra equipe (Task 8).
5. **Quadro com diurno fechado e noturno ainda não criado:** mostra o diurno fechado de hoje, sem pular para o dia anterior (Task 2, caso `"diurno fechado sem noturno"`).

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20261112000000_quadro_checkin.sql` (novo) | Tabelas, colunas, invariante de obra, `substituir_efetivo` escopada, `foto_checkin` + gatilho, RLS, ajustes em `salvar_programacao_atividade`/`foto_semana` |
| `lib/dominio/quadro.ts` (novo) | Puro: `EntradaQuadro`, `montarQuadro`, `resumoEquipe`, `escolherTurno`, `vizinhos`, `visaoPadrao`, `resolverEscolhaCampo`, `contarSemResponsavel` |
| `lib/db/responsaveis.ts` (novo) | CRUD de responsáveis |
| `lib/db/quadro.ts` (novo) | Entrada do quadro (sessão e admin por código), foto do check-in, link do quadro |
| `lib/db/atividades.ts`, `programacao.ts`, `execucao.ts`, `campo.ts`, `turnos.ts`, `validacao.ts`, `mensagens.ts` | `responsavel_id` nas leituras e gravações, efetivo escopado, filtro do campo |
| `components/quadro/*` (novo) | `Quadro.tsx` (server), `AtualizarPeriodicamente.tsx` (client) |
| `components/responsaveis/MenuResponsavel.tsx` (novo) | Menu único com "+ Novo responsável…" |
| `app/(app)/obras/[obraId]/page.tsx` + `Responsaveis.tsx`, `LinkQuadro.tsx` (novos) | Cadastro e link do quadro |
| `app/(app)/obras/[obraId]/quadro/page.tsx` (novo) | Quadro do planejador |
| `app/(app)/obras/[obraId]/turnos/[turnoId]/checkin/page.tsx` (novo) | Foto do check-in |
| `app/q/[codigo]/page.tsx` (novo) | Quadro público |
| `app/t/[token]/*` | Escolha do responsável e filtro |
| `app/(app)/obras/[obraId]/turnos/[turnoId]/*`, `programacao/[inicio]/*` | Agrupamento, menus, textos |

---

### Task 1: Migration e invariantes no banco

**Files:**
- Create: `supabase/migrations/20261112000000_quadro_checkin.sql`, `tests/integracao/quadro-banco.test.ts`

**Interfaces:**
- Produces (SQL):
  - `public.responsaveis` (spec §1). Índice único `responsaveis_obra_nome_uniq on (obra_id, lower(btrim(nome)))`, `check (btrim(nome) <> '' and length(btrim(nome)) <= 60)`, `telefone` com até 30 caracteres. RLS `responsaveis_all` no padrão de `efetivo_all` (`eh_membro` via `obras`). Trigger de `updated_at`.
  - As colunas `programacao_atividades.responsavel_id`, `atividades.responsavel_id`, `atividades.lancado_por_id` e `efetivo.responsavel_id` referenciam `responsaveis(id) on delete set null`, cada uma com índice.
  - Gatilho `tg_responsavel_mesma_obra` (before insert or update of `responsavel_id`/`lancado_por_id`) nas três tabelas. Se a coluna não é nula e o responsável não é da obra da linha (via turno ou semana), levanta `responsavel_invalido`.
  - `public.substituir_efetivo(p_turno_id uuid, p_responsavel_id uuid, p_esperado jsonb, p_linhas jsonb) returns void`. Tem a mesma lógica da versão atual (lock no turno, comparação ordenada, `efetivo_conflito`), mas filtra por `responsavel_id is not distinct from p_responsavel_id` na leitura, no delete e no insert (o insert grava `p_responsavel_id`). A versão `(uuid, jsonb, jsonb)` sai com `drop function`. Grants iguais aos atuais.
  - `public.foto_checkin(p_turno_id uuid) returns jsonb` no formato `EntradaQuadro` da Task 2, com chaves snake_case: `obra {id, nome}`, `turno {id, data, periodo, status, hora_inicio_prevista, hora_fim_prevista, hora_inicio_real, hora_fim_real}`, `responsaveis [{id, nome, ativo}]` (só os usados no turno), `atividades [{id, ordem, descricao, local, unidade, qtd_planejada, qtd_realizada, causa, programada, responsavel_id}]` (`programada = programacao_atividade_id is not null`) e `efetivo [{funcao, quantidade, responsavel_id}]`. Só `service_role` executa.
  - `public.checkin_fotos` (spec §1, `turno_id` único). Gatilho `turnos_emitir_checkin after update of status on turnos when (old.status = 'planejado' and new.status = 'em_campo')`, `security definer`, insere `emitido_em = now()` e `dados = foto_checkin(new.id)`. RLS somente select, igual a `rdo_versoes`.
  - `obras.quadro_token_hash text unique`.
  - `salvar_programacao_atividade` e `foto_semana`: `create or replace` copiando o corpo atual de `20261111000000_programacao_semanal.sql`. A primeira passa a gravar `responsavel_id = nullif(p_dados->>'responsavel_id','')::uuid`, e a segunda inclui `responsavel_id` em cada atividade.

- [ ] **Step 1: Escrever a migration** com o conteúdo acima. Antes do `drop function`, conferir com `grep -rn substituir_efetivo lib` que só `lib/db/execucao.ts` e `lib/db/campo.ts` chamam a função. `execucao.ts` é ajustado na Task 5 e `campo.ts` na Task 6. Até lá, os testes de integração de efetivo antigos ficam vermelhos (esperado).
- [ ] **Step 2: Guiar o usuário a aplicar no Supabase DEV** (SQL Editor) e confirmar "Success. No rows returned".
- [ ] **Step 3: Escrever `tests/integracao/quadro-banco.test.ts`** (padrão de `turno-eventos.test.ts`, uma obra própria por teste, inserts diretos com `u.cliente` e RPC):
  - `"nome duplicado na obra"`: inserir "João" e depois " joão " → erro com código `23505`; em outra obra → aceito;
  - `"responsável de outra obra"`: `atividades.responsavel_id`, `efetivo.responsavel_id` e `programacao_atividades.responsavel_id` com o id de outra obra → `responsavel_invalido`;
  - `"efetivo por equipe"`: as equipes A e B têm linhas; `substituir_efetivo(t, A, esperadoA, novas)` troca só as de A, e as de B ficam intactas; um `esperado` desatualizado de A → `efetivo_conflito`, mesmo com B mudando ao mesmo tempo;
  - `"efetivo legado"`: linha inserida sem `responsavel_id` é substituída com `p_responsavel_id = null` e `esperado` correto, sem conflito;
  - `"foto do check-in ao liberar"`: liberar o turno (`aplicarAcao(..., "liberar")`) → 1 linha em `checkin_fotos`, com `dados.atividades[0].responsavel_id` e `dados.responsaveis[0].nome`; enviar, fechar, reabrir e fechar de novo → continua 1 linha;
  - `"outra empresa não vê responsáveis nem fotos"`: o select com o cliente de `outro` volta vazio;
  - `"apagar obra"`: o delete da obra pelo admin funciona e remove `responsaveis` e `checkin_fotos` em cascata.
- [ ] **Step 4: Rodar** `$env:SUPABASE_TEST='1'; npx vitest run tests/integracao/quadro-banco.test.ts`. Esperado: tudo passa. Se falhar, corrigir a migration, reaplicar no DEV e rodar de novo.
- [ ] **Step 5: Commit** `feat(quadro): migration de responsáveis, efetivo por equipe e foto do check-in`.

### Task 2: Domínio puro do quadro

**Files:**
- Create: `lib/dominio/quadro.ts`, `tests/dominio/quadro.test.ts`

**Interfaces:**
- Consumes: `statusAtividade`, `hhTurno` (`lib/dominio/calculos.ts`), `compararTurnos` (`lib/dominio/regras.ts`), `Causa`, `Periodo`, `StatusTurno`, `StatusAtividade` (`lib/dominio/tipos.ts`).
- Produces:
```ts
export type ResponsavelRef = { id: string; nome: string; ativo: boolean };
export type EntradaQuadro = {
  obra: { id: string; nome: string };
  turno: { id: string; data: string; periodo: Periodo; status: StatusTurno;
    hora_inicio_prevista: string | null; hora_fim_prevista: string | null;
    hora_inicio_real: string | null; hora_fim_real: string | null };
  responsaveis: ResponsavelRef[];
  atividades: { id: string; ordem: number; descricao: string; local: string | null; unidade: string | null;
    qtd_planejada: number; qtd_realizada: number | null; causa: Causa | null; programada: boolean;
    responsavel_id: string | null }[];
  efetivo: { funcao: string; quantidade: number; responsavel_id: string | null }[];
};
export type Visao = "checkin" | "checkout";
export type ResumoEquipe = { concluidas: number; total: number; percentual: number | null;
  extras: number; base: "programadas" | "todas"; pessoas: number; hh: number | null };
export type FaixaQuadro = { responsavel: ResponsavelRef | null;   // null = "Sem responsável"
  atividades: (EntradaQuadro["atividades"][number] & { situacao: StatusAtividade })[];
  efetivo: { funcao: string; quantidade: number }[]; resumo: ResumoEquipe };
export type ModeloQuadro = { entrada: EntradaQuadro; faixas: FaixaQuadro[] };
export function montarQuadro(e: EntradaQuadro): ModeloQuadro;
export function resumoEquipe(faixa: Pick<FaixaQuadro, "atividades" | "efetivo">, turno: EntradaQuadro["turno"], temProgramadaNoTurno: boolean): ResumoEquipe;
export type TurnoRef = { id: string; data: string; periodo: Periodo; status: StatusTurno };
export function escolherTurno(turnos: TurnoRef[], hoje: string): { turno: TurnoRef | null; foraDeHoje: boolean };
export function vizinhos(turnos: TurnoRef[], id: string): { anterior: string | null; seguinte: string | null };
export function visaoPadrao(status: StatusTurno): Visao;
export function visaoValida(pedida: unknown, status: StatusTurno): Visao;
export function resolverEscolhaCampo(r: unknown, idsDoTurno: string[]): { modo: "escolher" } | { modo: "todos" } | { modo: "responsavel"; id: string };
export function contarSemResponsavel(atividades: { responsavel_id: string | null }[]): number;
export function textoSemResponsavel(n: number): string | null; // null quando 0
```

- [ ] **Step 1: Escrever `tests/dominio/quadro.test.ts`** com:
  - `montarQuadro`: faixas em ordem alfabética do nome (`localeCompare` pt-BR) e `null` por último, só quando há atividade ou efetivo sem responsável; atividades em `ordem`; `situacao` = `statusAtividade`; efetivo de um responsável sem atividades gera faixa própria; responsável inativo mantém `ativo: false`;
  - `resumoEquipe`: com programadas → `{concluidas: 0, total: 2, percentual: 0, extras: 1, base: "programadas"}` para 2 programadas não concluídas + 1 extra concluída; turno sem nenhuma programada → `base: "todas"`, total = todas; faixa sem atividades → `percentual: null`; `pessoas` = soma das quantidades; `hh` = `hhTurno(efetivo, previsto, real)` (3 pessoas, 07:00–15:48 → `26.4`);
  - `escolherTurno(turnos, "2026-11-11")`: diurno aberto + noturno → diurno; diurno fechado + noturno → noturno; só noturno → noturno; **"diurno fechado sem noturno"** → diurno, `foraDeHoje: false`; sem turno hoje → o último por `compararTurnos`, `foraDeHoje: true`; lista vazia → `{turno: null, foraDeHoje: false}`;
  - `vizinhos`: ordem cronológica por `compararTurnos`; bordas → `null`; id desconhecido → ambos `null`;
  - `visaoPadrao`: `planejado` → `"checkin"`; `em_campo`/`enviado`/`fechado` → `"checkout"`. `visaoValida("checkout", "planejado")` → `"checkin"`; `visaoValida("xyz", "fechado")` → `"checkout"`;
  - `resolverEscolhaCampo`: `undefined` com ids → `escolher`; `"todos"` → `todos`; id da lista → `responsavel`; id fora da lista ou texto → `escolher`; lista vazia → `todos` (sem tela de escolha);
  - `textoSemResponsavel`: `0` → `null`, `1` → `"1 atividade sem responsável"`, `3` → `"3 atividades sem responsável"`.
- [ ] **Step 2: Rodar** `npx vitest run tests/dominio/quadro.test.ts`. Esperado: FAIL (módulo inexistente).
- [ ] **Step 3: Implementar `lib/dominio/quadro.ts`.** `percentual` é uma fração de 0 a 1, como em `percentualCumprimento`. `temProgramadaNoTurno` é calculado uma vez em `montarQuadro` sobre todas as atividades.
- [ ] **Step 4: Rodar** de novo. Esperado: PASS.
- [ ] **Step 5: Commit** `feat(quadro): domínio puro do quadro`.

### Task 3: Cadastro de responsáveis + menu

**Files:**
- Create: `lib/db/responsaveis.ts`, `components/responsaveis/MenuResponsavel.tsx`, `app/(app)/obras/[obraId]/Responsaveis.tsx`, `app/(app)/obras/[obraId]/acoesResponsaveis.ts`, `tests/integracao/responsaveis.test.ts`
- Modify: `app/(app)/obras/[obraId]/page.tsx`, `lib/db/mensagens.ts`

**Interfaces:**
- Consumes: `Resultado`, `ok`, `falha` (`lib/db/resultado.ts`), `ResponsavelRef` (Task 2).
- Produces:
```ts
export type Responsavel = ResponsavelRef & { obra_id: string; telefone: string | null };
export async function listarResponsaveis(c: SupabaseClient, obraId: string): Promise<Responsavel[]>; // ativos e inativos, por nome
export async function criarResponsavel(c, obraId: string, dados: { nome: string; telefone?: string | null }): Promise<Resultado<Responsavel>>;
export async function editarResponsavel(c, id: string, dados: { nome: string; telefone?: string | null }): Promise<Resultado<Responsavel>>;
export async function definirAtivo(c, id: string, ativo: boolean): Promise<Resultado>;
// mensagens.ts
export const ERRO_RESPONSAVEL_DUPLICADO = "Já existe um responsável com esse nome nesta obra.";
export const ERRO_RESPONSAVEL_INVALIDO = "Responsável inválido para esta obra.";
// ErroBanco ganha "responsavel_invalido"
// MenuResponsavel (client)
type PropsMenu = { obraId: string; responsaveis: ResponsavelRef[]; valor: string | null;
  aoMudar: (id: string | null) => void; desabilitado?: boolean };
```
- [ ] **Step 1: Escrever `tests/integracao/responsaveis.test.ts`:** criar → aparece em `listarResponsaveis`; nome em branco ou com 61 caracteres → `falha`; duplicado → `ERRO_RESPONSAVEL_DUPLICADO`; editar; `definirAtivo(false)` → continua listado com `ativo: false`.
- [ ] **Step 2: Rodar** (integração). Esperado: FAIL.
- [ ] **Step 3: Implementar `lib/db/responsaveis.ts`** (trim no nome e no telefone; telefone vazio vira `null`). Implementar `MenuResponsavel`: as opções são os ativos em ordem alfabética, mais "Sem responsável". O valor atual inativo aparece como "<Nome> (inativo)". A opção "+ Novo responsável…" abre um campo de nome e chama a server action `criarResponsavelAcao(obraId, nome)` de `acoesResponsaveis.ts`; ao dar certo, seleciona o novo e chama `aoMudar`. A seção `Responsaveis.tsx` na página da obra faz lista, adicionar, editar e desativar/reativar (selo "inativo"). As actions chamam `revalidatePath` da obra.
- [ ] **Step 4: Rodar** integração + `npx vitest run tests/dominio`. Esperado: PASS.
- [ ] **Step 5: Commit** `feat(quadro): cadastro de responsáveis por obra`.

### Task 4: Responsável na programação semanal

**Files:**
- Modify: `lib/dominio/programacao.ts` (`AtividadeProgramada.responsavel_id: string | null`), `lib/db/programacao.ts` (leitura, `salvarAtividadeProgramada`, `trazerDaProgramacao`), `app/(app)/obras/[obraId]/programacao/[inicio]/FormAtividadeProgramada.tsx`, `GradeSemana.tsx`, `ListaRascunho.tsx`, `page.tsx`
- Test: `tests/integracao/programacao-turno.test.ts` (acrescentar), `tests/dominio/programacao.test.ts` (ajustar fixtures)

**Interfaces:**
- Consumes: `MenuResponsavel`, `listarResponsaveis` (Task 3); `contarSemResponsavel`, `textoSemResponsavel` (Task 2).
- Produces: `trazerDaProgramacao` grava `responsavel_id` da atividade programada. As props da grade recebem `responsaveis: ResponsavelRef[]` para mostrar o nome.

- [ ] **Step 1: Teste de integração `"trazer da programação copia o responsável"`:** programar com o responsável A, criar o turno do dia → a atividade do turno tem `responsavel_id = A`; mudar no turno (update direto) não muda `programacao_atividades.responsavel_id`.
- [ ] **Step 2: Rodar.** Esperado: FAIL.
- [ ] **Step 3: Implementar.** `salvarAtividadeProgramada` envia `responsavel_id` em `p_dados`, e `obterDadosSemana` lê a coluna. Formulário: campo "Responsável" com `MenuResponsavel`. Grade: nome em `text-xs` dentro da barra. Rascunho: `textoSemResponsavel(contarSemResponsavel(atividades))` como `Aviso tom="info"` acima do botão "Programar semana", sem bloquear.
- [ ] **Step 4: Rodar** `npx vitest run tests/dominio` + integração de programação. Esperado: PASS.
- [ ] **Step 5: Commit** `feat(quadro): responsável na programação semanal`.

### Task 5: Turno agrupado por responsável (check-in) + efetivo por equipe no planejador

**Files:**
- Modify: `lib/db/atividades.ts` (`Atividade.responsavel_id`, `lancado_por_id` em `COLUNAS`/`normalizarAtividade`; nova `definirResponsavel`), `lib/db/turnos.ts` (`Efetivo.responsavel_id`, select), `lib/db/validacao.ts`, `lib/db/execucao.ts` (`corrigirEfetivo` escopado), `app/(app)/obras/[obraId]/turnos/[turnoId]/{page.tsx, ListaAtividades.tsx, ItemAtividade.tsx, EdicaoExecucao.tsx, acoes.ts, acoesExecucao.ts, AcoesTurno.tsx}`
- Create: `app/(app)/obras/[obraId]/turnos/[turnoId]/EfetivoPorEquipe.tsx`
- Test: `tests/integracao/execucao.test.ts`, `tests/integracao/turnos.test.ts` (acrescentar)

**Interfaces:**
- Consumes: `montarQuadro` só para agrupar (Task 2), `MenuResponsavel` (Task 3), `substituir_efetivo` de 4 argumentos (Task 1).
- Produces:
```ts
export async function definirResponsavel(c, atividadeId: string, responsavelId: string | null): Promise<Resultado>; // turno não fechado
export async function salvarEfetivoPlanejador(c, turnoId: string, responsavelId: string | null,
  linhas: LinhaEfetivo[], esperado: LinhaEfetivo[]): Promise<Resultado>; // substitui o atual salvarEfetivo de execucao.ts
// EfetivoPorEquipe (client): uma BlocoEfetivo por faixa + "+ Adicionar equipe" (MenuResponsavel)
type PropsEfetivoPorEquipe = { obraId: string; responsaveis: ResponsavelRef[];
  efetivo: { funcao: string; quantidade: number; responsavel_id: string | null }[];
  opcoesFuncao: string[]; somenteLeitura?: boolean;
  salvar: (responsavelId: string | null, linhas: LinhaEfetivo[], esperado: LinhaEfetivo[]) => Promise<Resultado> };
```
- [ ] **Step 1: Testes de integração:** `"definir responsável"` (aceita em `planejado`/`em_campo`, recusa em `fechado` com `ERRO_FECHADO_PLANEJADOR`, outra obra → `ERRO_RESPONSAVEL_INVALIDO`); `"efetivo do planejador por equipe"` (salvar A não toca B); `"efetivo editável no turno planejado"`.
- [ ] **Step 2: Rodar.** Esperado: FAIL.
- [ ] **Step 3: Implementar.**
  - `ListaAtividades`: agrupa com cabeçalho por faixa, na mesma ordem de `montarQuadro`. Cada `ItemAtividade` ganha o `MenuResponsavel`, que chama `definirResponsavelAcao`.
  - `page.tsx`: carrega `listarResponsaveis`. No `planejado`, mostra `EfetivoPorEquipe` abaixo das atividades, o botão `"Ver quadro"` (link para `/obras/[obraId]/quadro?turno=[id]`) e, no `AcoesTurno` de liberar, o texto `"Ao liberar, o check-in fica registrado."`. Depois da liberação, `EdicaoExecucao` usa `EfetivoPorEquipe` e mostra as atividades de `BlocoAtividades` agrupadas: um bloco por faixa, com o nome do responsável como título. A mensagem de erro da liberação passa a ser `"Não foi possível liberar o turno. Tente de novo."` para erros que não são de regra.
  - As sugestões de função de cada equipe: as funções da `programacao_efetivo` das atividades programadas daquela equipe no dia, seguidas de `opcoesFuncao`, sem repetir.
- [ ] **Step 4: Rodar** `npx vitest run` + integração (`execucao`, `turnos`, `quadro-banco`). Esperado: PASS.
- [ ] **Step 5: Commit** `feat(quadro): turno agrupado por responsável e efetivo por equipe`.

### Task 6: Link de campo com escolha do responsável

**Files:**
- Modify: `lib/db/campo.ts`, `app/t/[token]/{page.tsx, acoes.ts, FormularioCampo.tsx}`
- Create: `app/t/[token]/EscolhaResponsavel.tsx`
- Test: `tests/integracao/campo.test.ts` (acrescentar)

**Interfaces:**
- Consumes: `resolverEscolhaCampo` (Task 2), `EfetivoPorEquipe` (Task 5).
- Produces (todas resolvem o turno pelo token, nunca por ids do cliente):
```ts
export async function responsaveisDoTurno(turno: TurnoCompleto): Promise<ResponsavelRef[]>; // usados em atividades/efetivo, por nome
export async function salvarExecucao(token: string, atividadeId: string, dados: DadosExecucao, responsavelId: string | null): Promise<Resultado>;
// responsavelId != null: recusa (ERRO_ATIVIDADE) atividade de outra equipe; grava lancado_por_id = responsavelId
// responsavelId == null ("Ver tudo"): comportamento atual, lancado_por_id = null
export async function salvarEfetivo(token: string, responsavelId: string | null, linhas: LinhaEfetivo[], esperado: LinhaEfetivo[]): Promise<Resultado>;
```
- [ ] **Step 1: Testes de integração:** `"campo com responsável salva só a sua equipe"` (atividade de B com `responsavelId = A` → `falha`, e `lancado_por_id` de A gravado na própria atividade); `"campo ver tudo"` (salva qualquer atividade, `lancado_por_id` null); `"efetivo do campo por equipe"`; `"responsável de outra obra no campo"` → `falha`.
- [ ] **Step 2: Rodar.** Esperado: FAIL.
- [ ] **Step 3: Implementar.**
  - `page.tsx` recebe `searchParams` e aplica `resolverEscolhaCampo(r, ids)`. No modo `escolher`, renderiza `EscolhaResponsavel`: título `"Quem é você?"`, botões grandes que são `<Link href="?r=<id>">`, mais `"Ver tudo"` (`?r=todos`).
  - No modo `responsavel`: topo com `"Lançando como <Nome> · Trocar"` (link para `?`), e `FormularioCampo` recebe só as atividades e o efetivo da equipe, mais o `responsavelId`. Sem o botão "Enviar" e sem o aviso de causas pendentes; no lugar, `Aviso tom="info"` com `"Terminou? Avise o planejador."`.
  - No modo `todos`: o formulário atual, com o efetivo em `EfetivoPorEquipe`.
  - Horário real e clima aparecem em todos os modos.
- [ ] **Step 4: Rodar** integração `campo` + `npx vitest run`. Esperado: PASS.
- [ ] **Step 5: Commit** `feat(quadro): link de campo filtrado por responsável`.

### Task 7: Quadro (planejador, link público e foto do check-in)

**Files:**
- Create: `lib/db/quadro.ts`, `components/quadro/Quadro.tsx`, `components/quadro/AtualizarPeriodicamente.tsx`, `app/(app)/obras/[obraId]/quadro/page.tsx`, `app/q/[codigo]/page.tsx`, `app/(app)/obras/[obraId]/turnos/[turnoId]/checkin/page.tsx`, `app/(app)/obras/[obraId]/LinkQuadro.tsx`, `app/(app)/obras/[obraId]/acoesQuadro.ts`, `tests/integracao/quadro.test.ts`, `tests/dominio/quadro-ui.test.tsx`
- Modify: `app/(app)/obras/[obraId]/page.tsx`, `app/(app)/obras/[obraId]/turnos/[turnoId]/HistoricoTurno.tsx`, `lib/dominio/link.ts`

**Interfaces:**
- Consumes: `montarQuadro`, `escolherTurno`, `vizinhos`, `visaoValida`, `EntradaQuadro` (Task 2); `gerarToken`, `hashToken`; `hojeSaoPaulo`.
- Produces:
```ts
// lib/db/quadro.ts
export type FotoCheckin = { emitido_em: string; dados: EntradaQuadro };
export async function entradaDoTurno(c: SupabaseClient, turnoId: string): Promise<EntradaQuadro | null>;
export async function turnosDaObra(c: SupabaseClient, obraId: string): Promise<TurnoRef[]>;
export async function fotoCheckin(c: SupabaseClient, turnoId: string): Promise<FotoCheckin | null>;
export async function gerarLinkQuadro(c: SupabaseClient, obraId: string): Promise<Resultado<{ codigo: string }>>;
export async function temLinkQuadro(c: SupabaseClient, obraId: string): Promise<boolean>;
export async function obraPorCodigo(codigo: string): Promise<{ id: string } | null>; // admin; formato igual ao TOKEN_FORMATO do campo
export function clienteDoQuadroPublico(): SupabaseClient; // admin; usado SÓ com a obra resolvida pelo código
// lib/dominio/link.ts
export function urlQuadro(codigo: string): string; // `${origem}/q/${codigo}`, mesmo padrão de urlCampo
// components/quadro/Quadro.tsx (server)
type PropsQuadro = { modelo: ModeloQuadro; visao: Visao; publico: boolean;
  navegacao?: { anterior: string | null; seguinte: string | null; agora: boolean; base: string };
  aviso?: string | null; editarHref?: string | null };
// AtualizarPeriodicamente (client): useEffect com setInterval de 30000 ms que chama router.refresh()
// só quando document.visibilityState === "visible"; limpa no unmount.
```
- [ ] **Step 1: Testes.**
  - `tests/dominio/quadro-ui.test.tsx` (padrão de `analise-ui.test.tsx`): renderizar `Quadro` com a visão check-in → mostra `"CHECK-IN"`, o nome da faixa, `"EXTRA"` na extra e a faixa `"Sem responsável"` por último. Visão check-out → `"0 de 2 programadas · 0%"`, `"+1 extra"` e a causa. Com `publico: true`, não aparece `"Editar"` nem telefone. Turno fechado → `"Turno fechado"`.
  - `tests/integracao/quadro.test.ts`: `entradaDoTurno` traz os nomes dos responsáveis; `gerarLinkQuadro` → `obraPorCodigo(codigo)` resolve; gerar de novo → o código antigo resolve `null`; código mal formado → `null` sem consultar o banco; `fotoCheckin` existe depois de liberar.
- [ ] **Step 2: Rodar.** Esperado: FAIL.
- [ ] **Step 3: Implementar.**
  - **Rotas.** Ler antes em `node_modules/next/dist/docs/` como funcionam `searchParams` assíncronos e `router.refresh`. `/obras/[obraId]/quadro`: `?turno=` ou `escolherTurno(turnosDaObra, hojeSaoPaulo())`; `?visao=` validada com `visaoValida`. Aviso `"Sem turno hoje — mostrando <dd/mm> <período>"` quando `foraDeHoje`; `"Nenhum turno ainda"` quando não há turno. `editarHref` aponta para a tela do turno.
  - **Seletor de visão.** No cabeçalho do `Quadro`, links `"Check-in"` / `"Check-out"` (`?visao=`, preservando `?turno=`). O `"Check-out"` não aparece em turno `planejado`. Fica oculto na foto do check-in.
  - **Visão de check-in de turno já liberado.** Usa `montarQuadro(foto.dados)` se houver foto. Se não houver, usa os dados atuais com o aviso `"Check-in sem registro oficial"`.
  - **`/q/[codigo]`.** Mesma lógica com `obraPorCodigo` e o cliente admin escopado à obra. O `?turno=` precisa pertencer à obra, senão volta ao automático. Metadata igual à do link de campo (`force-dynamic`, `noindex`, `referrer: no-referrer`). Código inválido → `"Link desativado. Peça o link novo ao planejador."`. A rota fica fora de `/obras`, então o `proxy.ts` não exige login (conferir).
  - **`/turnos/[turnoId]/checkin`.** Desenha a foto com a visão check-in, sem navegação e sem atualização. Sem foto → `notFound()`.
  - **Visual.** Layout B do brainstorming: cabeçalho `bg-primaria` (`#002F6C`), selo CHECK-IN laranja (`#FF6B00`), faixas brancas com borda à esquerda `operacional`, nome e efetivo numa coluna de ~150px e atividades em duas colunas a partir de `lg`. No celular, tudo em uma coluna. Fontes maiores a partir de `xl` (TV). Barra verde/amarela/vermelha pela `situacao`. Nas faixas, HH com uma casa decimal e vírgula.
  - **Página da obra.** `LinkQuadro` com `"Gerar link"` ou `"Copiar"` / `"Abrir"` / `"Gerar novo link"` (com `confirm` e o texto exato). O código só aparece logo após ser gerado, como no `PainelLink`. Depois disso, `"Copiar"` e `"Abrir"` exigem gerar de novo; seguir o mesmo comportamento do `PainelLink` existente.
  - **Linha do tempo.** O evento `liberado` aparece como `"Check-in registrado"`, com link para `checkin` quando há foto.
- [ ] **Step 4: Rodar** `npx vitest run` + integração `quadro`. Esperado: PASS.
- [ ] **Step 5: Commit** `feat(quadro): quadro do planejador, link público e foto do check-in`.

### Task 8: Textos, E2E e publicação

**Files:**
- Modify: `app/(app)/obras/[obraId]/turnos/[turnoId]/PainelLink.tsx` ("Link de campo"), `.../page.tsx` ("Quem estiver com o link de campo precisa recarregar a página para ver as mudanças."), `app/(publico)/page.tsx` ("A equipe de campo lança pelo celular" / "A equipe de campo registra o que foi feito e a causa do que não foi, sem instalar nada.")
- Create: `tests/e2e/quadro.spec.ts`
- Modify: testes que procuram os textos antigos (`grep -rn "encarregado" tests`)

- [ ] **Step 1: Trocar os três textos** e ajustar os testes que os procuram.
- [ ] **Step 2: Escrever `tests/e2e/quadro.spec.ts`** (padrão de `programacao.spec.ts` + `preparar.ts`): cadastrar os responsáveis "Ana" e "João" → programar a semana com uma atividade de cada → criar o turno do dia → `"Ver quadro"` mostra `"CHECK-IN"` e as duas faixas → liberar → a linha do tempo mostra `"Check-in registrado"` → abrir o link de campo, que mostra `"Quem é você?"` → escolher "Ana" e lançar a quantidade total → gerar o link do quadro na obra → abrir `/q/<codigo>` sem sessão (novo contexto) e ver `"CHECK-OUT"`, `"1 de 1 programadas · 100%"` na faixa Ana. Ainda nesse contexto, abrir `/t/<token>?r=<id de outra obra>` e ver `"Quem é você?"` (Review Focus 4).
- [ ] **Step 3: Rodar** a suíte completa: `npx vitest run`, a integração e o E2E. Esperado: tudo PASS. Rodar também `npx tsc --noEmit` e `npx eslint .` sem erros.
- [ ] **Step 4: Commit** `feat(quadro): textos de campo e teste ponta a ponta`.
- [ ] **Step 5: Revisão final por subagente** (opus) da branch inteira contra a spec. Corrigir o que for importante e fazer commit.
- [ ] **Step 6: Publicar.** `git push -u origin quadro-checkin` → guiar o usuário a validar a prévia da Vercel. Com o aceite: guiar a aplicação da migration no Supabase **PROD** → `git checkout main; git merge --no-ff quadro-checkin; git push` → confirmar o deploy de produção. Atualizar as memórias `frentia-roadmap-lps` e `frentia-mvp-status`.
