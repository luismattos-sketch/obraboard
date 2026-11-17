# Efetivo e HH corretos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empréstimo entre equipes, saída antes e pessoas paradas registrados como "ocorrências do efetivo", e HH
calculado por equipe descontando o intervalo de refeição gravado no turno (produtivo × parado).

**Architecture:** Tabela nova `efetivo_ocorrencias` + janela de intervalo em `obras` (padrão) e `turnos` (copiada
na criação). Uma função pura `calcularHH` (simula pessoa a pessoa) é a única regra de contagem; resumo do turno,
quadro, semana (PrevistoReal) e RDO passam a usá-la. Linhas de efetivo e `substituir_efetivo` não mudam.

**Tech Stack:** Next.js (ler `node_modules/next/dist/docs/` antes de mexer em rotas/server actions), Supabase
Postgres + RLS, TypeScript, vitest, Playwright, @react-pdf (RDO).

**Spec:** `docs/superpowers/specs/2026-11-16-efetivo-hh-design.md`

## Global Constraints

- Nunca usar `localStorage`/`sessionStorage`.
- Termo no app: "Responsável" (nunca "encarregado").
- Textos da UI em pt-BR. Rótulos: "Emprestar", "Saída antes", "Parados", "HH parado".
- Intervalo padrão: diurno 12:00–13:00; noturno 00:00–01:00.
- Turnos já fechados ficam sem intervalo (HH idêntico ao de hoje). Versões antigas do RDO sem os campos novos leem
  como hoje.
- Migration nova: `supabase/migrations/20261116000000_efetivo_hh.sql`. Não há psql/CLI: aplicar em DEV pelo SQL
  Editor guiando o usuário antes dos testes de integração; PROD só no deploy (Task 9).
- Testes pelo PowerShell com `Set-Location 'C:\Users\LuisVillaca\Documents\ObraApp'` (C maiúsculo). Unitários:
  `npx vitest run <arquivo>`; integração: `$env:SUPABASE_TEST='1'; npx vitest run tests/integracao/<arquivo>`;
  E2E: `$env:SUPABASE_TEST='1'; npx playwright test <arquivo>`.
- Arquivos do repo têm CRLF: preservar.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branch: `efetivo-hh`.

## Review Focus

1. Turno noturno (22:00–06:00) com empréstimo e intervalo 00:00–01:00 → horas certas, nada negativo (Task 1).
2. Reenvio de "criar ocorrência" após envio sem resposta → não duplica; remover algo já removido → sucesso (Task 3).
3. RDO v1 antigo (foto sem `ocorrencias`/intervalo) → mesmo HH de antes (Task 4).
4. Linha reduzida abaixo das ocorrências → números limitados + aviso visível no turno e no campo (Tasks 1 e 6).
5. Responsável de campo tentando lançar Parados/Saída num empréstimo destinado a outra equipe, ou emprestar para si
   mesmo → recusado (Task 3).

---

### Task 1: Regra de contagem pura

**Files:**
- Create: `lib/dominio/efetivoHH.ts`
- Test: `tests/dominio/efetivo-hh.test.ts`

**Interfaces:**
- Consumes: `horasEntre`-style parsing de `lib/dominio/calculos.ts` (reusar `minutos` exportando-o), `chaveFuncao`
  (exportar de `calculos.ts`), `Causa` de `lib/dominio/tipos.ts`.
- Produces:
```ts
export type TipoOcorrencia = "emprestimo" | "saida" | "parado";
export type Ocorrencia = {
  id: string; responsavel_id: string | null; funcao: string; tipo: TipoOcorrencia; quantidade: number;
  hora_inicio: string; hora_fim: string | null; destino_responsavel_id: string | null;
  emprestimo_id: string | null; causa: Causa | null; created_at: string;
};
export type Janela = { inicio: string; fim: string };
export type EntradaHH = {
  efetivo: { funcao: string; quantidade: number; responsavel_id: string | null }[];
  ocorrencias: Ocorrencia[];
  janela: Janela | null;      // já escolhida: real se completa, senão prevista
  intervalo: Janela | null;
};
export type Recebido = { emprestimo_id: string; de: string | null; funcao: string; quantidade: number; inicio: string; fim: string };
export type HHEquipe = {
  responsavel_id: string | null; pessoas: number;
  hhProdutivo: number | null; hhParado: number | null; hhParadoPorCausa: Partial<Record<Causa, number>>;
  recebidos: Recebido[]; avisos: string[];
};
export type ResultadoHH = {
  equipes: HHEquipe[]; pessoas: number;
  hh: number | null; hhProdutivo: number | null; hhParado: number | null;
  hhParadoPorCausa: Partial<Record<Causa, number>>; avisos: string[];
};
export function janelaDoTurno(t: { hora_inicio_prevista: string | null; hora_fim_prevista: string | null;
  hora_inicio_real: string | null; hora_fim_real: string | null }): Janela | null;
export function intervaloDoTurno(t: { intervalo_inicio?: string | null; intervalo_fim?: string | null }): Janela | null;
export function calcularHH(e: EntradaHH): ResultadoHH;
export function descreverOcorrencia(o: Ocorrencia, nome: (id: string | null) => string): string;
```

Algoritmo (o que a assinatura não determina):
- Linha do tempo em minutos relativos ao início da janela: `t = (min − inicio + 1440) % 1440`, duração
  `D = horasEntre(janela)×60`; horários de ocorrência e do intervalo mapeados igual e limitados a `[0, D]`.
- Para cada linha (equipe + `chaveFuncao(funcao)`, somando linhas repetidas), cria `quantidade` pessoas, cada uma com
  presença `[0, D]` na equipe de origem, sem empréstimo, sem saída.
- Ocorrências em ordem de `created_at` (empate: `id`). Cada uma pega as primeiras N pessoas elegíveis da linha
  (`responsavel_id` + `chaveFuncao(funcao)`):
  - `emprestimo` (sem `emprestimo_id`): elegíveis = não emprestadas e não saídas. Presença em `[H, H' ?? D)` passa
    para `destino_responsavel_id`; marca a pessoa com o id do empréstimo.
  - `saida` sem `emprestimo_id`: elegíveis = não emprestadas e não saídas; corta toda presença em H.
  - `parado` sem `emprestimo_id`: elegíveis = não emprestadas; marca parado `[H1,H2]` ∩ presença na origem.
  - `saida`/`parado` com `emprestimo_id`: elegíveis = pessoas daquele empréstimo; saída corta a presença em H
    (inclusive no destino); parado marca `[H1,H2]` ∩ presença no destino. HH parado vai para o destino.
  - Elegíveis < N → aplica às disponíveis e gera aviso (ex.: `"Montador de andaime: 2 emprestados, mas a linha tem 1"`)
    na equipe que registrou e em `avisos` do total.
- Por pessoa e equipe: horas = Σ(segmento − sobreposição com intervalo); parado = (união dos intervalos parados ∩
  segmento) − intervalo; produtivo = horas − parado.
- `pessoas` da equipe = Σ quantidade das suas linhas (recebidos não contam); total = Σ das equipes.
- Equipe aparece em `equipes` se tem linha ou recebeu empréstimo. `recebidos` lista cada empréstimo recebido
  (horários em HH:MM).
- `janela === null` ou total de pessoas 0 → `hh`, `hhProdutivo`, `hhParado` = `null` (equipes também).
- Sem arredondar (quem exibe arredonda a 0,1).

- [ ] **Step 1: Write failing tests** (`describe("calcularHH")`), com janela 07:00–17:00 e intervalo 12:00–13:00 salvo onde indicado:
  - `"sem ocorrências: 6 pessoas → 54 HH (desconta 1 h de almoço)"` → equipe Rita `pessoas 6, hhProdutivo 54, hhParado 0`.
  - `"intervalo null mantém a conta antiga"` → 6 × 10 = 60.
  - `"Rita empresta 2 para Ana a partir de 13:00"` (Rita 6 Montador, Ana 5 Caldeireiro) → total `pessoas 11`;
    Rita `hhProdutivo 6×9 − 2×4 = 46`; Ana `5×9 + 2×4 = 53`; Ana `recebidos[0]` = `{de: rita, quantidade 2, inicio "13:00", fim "17:00"}`; total `hh 99`.
  - `"empréstimo com volta: 08:00 até 12:00"` → Ana recebe 2×4 = 8; Rita 6×9 − 8 = 46.
  - `"saída antes do almoço não desconta intervalo"`: 2 saem 12:00 → Rita `4×9 + 2×5 = 46`.
  - `"parado atravessando o almoço"`: 2 parados 11:00–14:00 causa `material` → `hhParado 4`, `hhParadoPorCausa.material 4`, `hhProdutivo 50`.
  - `"parado registrado pelo destino sobre o empréstimo"`: empréstimo 2 → Ana 13:00; Ana `parado` 15:00–16:00 com `emprestimo_id` → Ana `hhParado 2`, Rita `hhParado 0`.
  - `"incoerência: linha 1, empréstimo 2"` → empresta só 1; `avisos` com 1 item contendo `"2 emprestados"`.
  - `"ordem de corte por created_at"`: linha 2; saída(2, 15:00, t1) depois empréstimo(2, 13:00, t2) → empréstimo
    sem elegíveis, aviso; Rita `2×7 = 14` (07–15 menos almoço).
  - `"noturno atravessa meia-noite"`: janela 22:00–06:00, intervalo 00:00–01:00, 4 pessoas, empréstimo 2 → B a partir de 02:00
    → A `2×7 + 2×3 = 20`, B `2×4 = 8`.
  - `"sem janela → HH null, pessoas contadas"`.
  - `janelaDoTurno`: real completa vence; real incompleta → prevista; nada → null.
  - `descreverOcorrencia`: `"2 Montador de andaime emprestados → Ana a partir de 13:00"`, `"… de 08:00 até 12:00"`, `"2 saíram às 12:00"`, `"2 parados 08:00–10:00 · Material"`.
- [ ] **Step 2:** `npx vitest run tests/dominio/efetivo-hh.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar `lib/dominio/efetivoHH.ts` (exportar `minutos` e `chaveFuncao` de `calculos.ts`).
- [ ] **Step 4:** Rodar de novo → PASS; `npx vitest run tests/dominio/calculos.test.ts` continua PASS.
- [ ] **Step 5:** Commit `feat(efetivo): regra pura de HH com empréstimo, saída antes, parados e intervalo`.

### Task 2: Migration

**Files:**
- Create: `supabase/migrations/20261116000000_efetivo_hh.sql`
- Test: `tests/integracao/efetivo-hh-banco.test.ts`

**Interfaces:**
- Produces (banco):
  - `obras.intervalo_diurno_inicio/fim`, `obras.intervalo_noturno_inicio/fim` (`time`, defaults `12:00/13:00`,
    `00:00/01:00`; preencher as existentes).
  - `turnos.intervalo_inicio`, `turnos.intervalo_fim` (`time`, nulos). Gatilho `before insert` copia da obra
    conforme `periodo` quando ambos vierem nulos. Backfill só em `status <> 'fechado'` (rodar o update antes de
    criar nada que bloqueie; `tg_turno_fechado_imutavel` não é afetado porque não toca fechados).
  - `public.efetivo_ocorrencias` com colunas da spec (`id uuid pk default gen_random_uuid()`, `turno_id` cascade,
    `responsavel_id`, `funcao text not null`, `tipo text check in (...)`, `quantidade int check > 0`,
    `hora_inicio time not null`, `hora_fim time`, `destino_responsavel_id`, `emprestimo_id` → self cascade,
    `causa` (mesmo check de `atividades.causa`), `created_at`, `updated_at`).
    Checks por tipo: emprestimo ⇒ destino not null, emprestimo_id null, causa null, destino distinto de
    responsavel_id; saida ⇒ hora_fim null, destino null, causa null; parado ⇒ hora_fim not null, causa not null,
    destino null.
  - Gatilhos: `tg_bloquear_turno_fechado` (o mesmo de `efetivo`); responsável/destino da mesma obra (estender
    `tg_responsavel_mesma_obra` para esta tabela, incluindo `destino_responsavel_id`); gatilho
    `tg_ocorrencia_emprestimo`: com `emprestimo_id`, exige mesmo `turno_id`, pai `tipo='emprestimo'`,
    `pai.destino_responsavel_id is not distinct from new.responsavel_id`, `funcao` igual e `tipo in ('saida','parado')`
    (erro `ocorrencia_invalida`).
  - RLS/grants e índice `turno_id` no padrão de `public.efetivo`.
  - `foto_rdo` e `foto_checkin` (recriar a partir da última definição) incluem `intervalo_inicio`, `intervalo_fim` no
    objeto do turno e array `ocorrencias` (todas as colunas da `Ocorrencia`). `foto_semana`: incluir `intervalo_*` e
    `ocorrencias` em cada turno, se ela carrega o efetivo dos turnos.
- [ ] **Step 1: Write failing tests** (`describe.skipIf(!process.env.SUPABASE_TEST)`, usando `tests/integracao/ajuda.ts`):
  - `"turno novo diurno herda 12:00–13:00 da obra"` e `"noturno herda 00:00–01:00"`.
  - `"ocorrência em turno fechado é recusada"`.
  - `"empréstimo para a própria equipe é recusado"` (violação de check).
  - `"parado sobre empréstimo de outra equipe é recusado"` (`ocorrencia_invalida`).
  - `"remover empréstimo remove as ocorrências penduradas"`.
  - `"foto_rdo inclui ocorrencias e intervalo"`.
- [ ] **Step 2:** Rodar sem migration aplicada → FAIL.
- [ ] **Step 3:** Escrever a migration; guiar o usuário para colar no SQL Editor do Supabase **DEV**.
- [ ] **Step 4:** Rodar integração → PASS; `tests/integracao/invariantes.test.ts` e `quadro-banco.test.ts` continuam PASS.
- [ ] **Step 5:** Commit `feat(db): ocorrências do efetivo e intervalo por obra/turno`.

### Task 3: Camada de dados das ocorrências

**Files:**
- Create: `lib/db/ocorrencias.ts`
- Modify: `lib/db/turnos.ts` (`Turno` + `COLUNAS_TURNO` com `intervalo_inicio, intervalo_fim`; `TurnoCompleto.ocorrencias: Ocorrencia[]`; `obterTurnoCompleto` seleciona `efetivo_ocorrencias(*)` ordenado por `created_at`), `lib/db/quadro.ts`, `lib/db/programacao.ts` (carregar intervalo + ocorrências dos turnos), `lib/db/validacao.ts`, `lib/db/mensagens.ts`
- Test: `tests/integracao/ocorrencias.test.ts`, `tests/dominio/entrada.test.ts` (validação)

**Interfaces:**
- Consumes: `Ocorrencia`, `TipoOcorrencia` (Task 1); `turnoAberto`/`turnoAbertoParaCorrecao`, `erroBanco`, `erroGravacao`, `Resultado` existentes.
- Produces:
```ts
export type DadosOcorrencia = Omit<Ocorrencia, "created_at" | "responsavel_id">; // id gerado no cliente (crypto.randomUUID)
export function validarOcorrencia(d: DadosOcorrencia, janela: Janela | null): Resultado<DadosOcorrencia>;
export async function criarOcorrenciaCampo(token: string, d: DadosOcorrencia, responsavelId: string | null): Promise<Resultado>;
export async function removerOcorrenciaCampo(token: string, id: string, responsavelId: string | null): Promise<Resultado>;
export async function criarOcorrenciaPlanejador(c: SupabaseClient, turnoId: string, responsavelId: string | null, d: DadosOcorrencia): Promise<Resultado>;
export async function removerOcorrenciaPlanejador(c: SupabaseClient, turnoId: string, id: string): Promise<Resultado>;
```
Regras: `validarOcorrencia` — quantidade inteira 1..999; horários `horaValida`; checks por tipo (como no banco);
com janela conhecida, horários dentro dela e, para parado/empréstimo com "até", fim depois do início na linha do
tempo do turno; sem janela, parado exige fim ≠ início. Criar: sem `emprestimo_id`, a função tem de existir nas
linhas de efetivo da equipe (`chaveFuncao`) — senão `"Adicione a função no efetivo antes."`; com `emprestimo_id`,
o empréstimo tem de ser do turno e destinado a `responsavelId` (campo) / à equipe informada (planejador); destino
tem de ser responsável ativo da obra. Insert com o `id` do cliente: violação de pk (`23505`) → reler; igual → `ok`
(reenvio já gravado), diferente → falha. Remover inexistente → `ok`. Campo só remove ocorrência cujo
`responsavel_id` é o dele.
- [ ] **Step 1: Failing tests:** unitários de `validarOcorrencia` (hora `"25:00"`, parado sem causa, empréstimo sem
  destino, parado 10:00–08:00 em janela 07–17 → falha); integração: `"criar duas vezes o mesmo id não duplica"`,
  `"remover já removida é sucesso"`, `"campo não lança parado em empréstimo de outra equipe"`, `"campo não empresta
  para si"`, `"função inexistente na equipe é recusada"`, `"obterTurnoCompleto traz ocorrências e intervalo"`.
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar → PASS; `tests/integracao/campo.test.ts` e `execucao.test.ts` continuam PASS.
- [ ] **Step 5:** Commit `feat(db): criar e remover ocorrências do efetivo (campo e planejador)`.

### Task 4: Ligar a regra nos consumidores

**Files:**
- Modify: `lib/dominio/resumo.ts`, `lib/dominio/quadro.ts`, `lib/dominio/programacao.ts`, `lib/rdo/versao.ts`, `lib/dominio/calculos.ts` (`hhTurno` passa a ser usado só pelo HH previsto ou é removido)
- Test: `tests/dominio/resumo.test.ts`, `quadro.test.ts`, `programacao.test.ts`, `rdo-versao.test.ts`

**Interfaces:**
- Consumes: `calcularHH`, `janelaDoTurno`, `intervaloDoTurno` (Task 1); `TurnoCompleto.ocorrencias` (Task 3).
- Produces:
  - `ResumoTurno` ganha `hhParado: number | null`, `hhParadoPorCausa`, `avisosEfetivo: string[]`, `hhEquipes: HHEquipe[]`; `hh` = total (produtivo + parado); `efetivoTotal` = `pessoas` de `calcularHH`.
  - `EntradaQuadro.turno` ganha `intervalo_inicio?`, `intervalo_fim?`; `EntradaQuadro.ocorrencias?: Ocorrencia[]` (ausente na foto antiga = `[]`). `ResumoEquipe` ganha `hhParado: number | null`, `recebidos: Recebido[]`; `hh` = total da equipe arredondado a 0,1. Equipe que só recebeu empréstimo vira faixa.
  - PrevistoReal: `hhReal` via `calcularHH`; `hhPrevisto` = `totalPrevisto ×` (janela − intervalo).
  - `lerFoto`: `ocorrencias: f.ocorrencias ?? []`, intervalo `?? null`.
- [ ] **Step 1: Failing tests:** `resumo`: caso Rita/Ana → `efetivoTotal 11`, `hh 99`; `quadro`: faixa Ana com `recebidos.length 1` e `hh 53`; faixa só-recebedora existe; `programacao`: `hhPrevisto` desconta intervalo; `rdo-versao`: `"foto v1 antiga sem ocorrencias mantém HH antigo"` (intervalo null → 6×10 = 60).
- [ ] **Step 2:** Rodar → FAIL. **Step 3:** Implementar. **Step 4:** `npx vitest run tests/dominio` → PASS (ajustar expectativas antigas só onde o intervalo padrão muda o número, comentando o porquê).
- [ ] **Step 5:** Commit `feat(efetivo): resumo, quadro, semana e RDO usam a nova conta de HH`.

### Task 5: RDO em PDF

**Files:**
- Modify: `lib/rdo/secoes.tsx`
- Test: `tests/dominio/rdo.test.tsx`

- [ ] **Step 1: Failing test:** RDO do caso Rita/Ana com parado 2 h `material` contém `"HH parado"`, `"4"` (número BR), `"Efetivo total"` `11`, e a linha `"2 Montador de andaime emprestados → Ana a partir de 13:00"` na seção de efetivo; RDO sem ocorrências não mostra `"HH parado"`.
- [ ] **Step 2–4:** FAIL → implementar (métrica `HH parado` só se `hhParado > 0`; ocorrências abaixo da lista por função, via `descreverOcorrencia`) → PASS.
- [ ] **Step 5:** Commit `feat(rdo): HH parado e ocorrências do efetivo no PDF`.

### Task 6: Tela do efetivo (campo e turno)

**Files:**
- Create: `components/execucao/OcorrenciasEfetivo.tsx`
- Modify: `components/execucao/EfetivoPorEquipe.tsx`, `components/execucao/BlocoEfetivo.tsx`, `app/t/[token]/acoes.ts`, `app/t/[token]/FormularioCampo.tsx`, `app/t/[token]/page.tsx`, `app/(app)/obras/[obraId]/turnos/[turnoId]/acoesExecucao.ts`, `.../EfetivoTurno.tsx`, `.../page.tsx`, `lib/db/validacao.ts`
- Test: `tests/dominio/ocorrencias-ui.test.tsx`, `tests/dominio/efetivo-equipe.test.tsx`

**Interfaces:**
- Consumes: Task 3 (`criarOcorrencia*`, `removerOcorrencia*`), Task 1 (`calcularHH`, `descreverOcorrencia`, `HHEquipe`).
- Produces: `OcorrenciasEfetivo` props `{ responsavelId: string | null; funcoes: string[]; ocorrencias: Ocorrencia[]; recebidos: Recebido[]; destinos: ResponsavelRef[]; resumo: HHEquipe | null; somenteLeitura?: boolean; criar(d: DadosOcorrencia): Promise<Resultado<unknown>>; remover(id: string): Promise<Resultado<unknown>> }`. Server actions `criarOcorrenciaAcao` / `removerOcorrenciaAcao` em cada lado.

Comportamento: sob cada função, lista as ocorrências com ✕; botões `+ Emprestar`, `+ Saída antes`, `+ Parados`
abrem formulário curto (spec); nos recebidos (`"+2 Montador de andaime (da Rita, 13:00–17:00)"`) só
`+ Saída antes` e `+ Parados`. Resumo da equipe `"6 pessoas · 52 HH (4 HH parados)"` (HH com 1 casa, vírgula).
Avisos de incoerência em destaque neutro. Envio pela fila/repetição existente (`repeticao.ts`) e registro em
`rastreioSalvamento` (padrão do efetivo), id via `crypto.randomUUID()` criado uma vez por formulário enviado.
"Outra função…": recusar texto com `/\b(parad[oa]s?|ocios[oa]s?)\b/i` com `"Para gente parada use o botão Parados."`
— na UI e em `validarEfetivo` apenas para linhas que não estão em `esperado` (linhas antigas continuam salváveis).
- [ ] **Step 1: Failing tests:** `"Emprestar envia quantidade, função, destino e hora"`, `"destino não lista a própria equipe"`, `"recebido oferece só Saída antes e Parados"`, `"mostra aviso de incoerência"`, `"Outra função recusa 'Mecânico parado'"`, `"validarEfetivo aceita linha antiga 'parado' presente em esperado"`.
- [ ] **Step 2–4:** FAIL → implementar → PASS (`npx vitest run tests/dominio`).
- [ ] **Step 5:** Commit `feat(efetivo): emprestar, saída antes e parados no campo e no turno`.

### Task 7: Editar intervalo (obra e turno)

**Files:**
- Modify: `lib/db/obras.ts` (`editarIntervalosObra(c, obraId, d: { diurno: Janela | null; noturno: Janela | null }): Promise<Resultado>`), `lib/db/execucao.ts` (`salvarIntervaloTurno(c, turnoId, j: Janela | null): Promise<Resultado>`, turno aberto para correção), `app/(app)/obras/[obraId]/page.tsx` + componente `IntervaloObra.tsx`, `components/execucao/BlocoHorario.tsx` (planejador: linha "Intervalo 12:00–13:00 [alterar]"; campo: só exibe)
- Test: `tests/integracao/obras.test.ts`, `tests/integracao/execucao.test.ts`

- [ ] **Step 1: Failing tests:** `"editar intervalo da obra não altera turno existente"`, `"turno novo usa o novo intervalo"`, `"salvarIntervaloTurno null zera"`, `"intervalo com fim antes do início no diurno é recusado"`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit `feat(obra): intervalo de refeição editável na obra e no turno`.

### Task 8: Quadro e TV

**Files:**
- Modify: `components/quadro/Quadro.tsx`
- Test: `tests/dominio/quadro-ui.test.tsx`

- [ ] **Step 1: Failing test:** faixa mostra `"6 pessoas · 46,0 HH · 4,0 HH parados"` (parados só se > 0) e a linha recebida `"+2 Montador de andaime (da Rita, 13:00–17:00)"`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit `feat(quadro): HH parado e emprestados no quadro`.

### Task 9: E2E, revisão e entrega

**Files:**
- Create: `tests/e2e/efetivo-hh.spec.ts` (usar `tests/e2e/preparar.ts`; pré-aquecer rotas com `page.request.get`)

- [ ] **Step 1:** E2E `"Rita empresta 2 para Ana pelo link → quadro e RDO com 11 pessoas"`: obra com Rita (6 Montador) e Ana (5 Caldeireiro), turno 07–17; Rita pelo link emprestar 2 → Ana a partir de 13:00; quadro mostra Ana com o recebido e total coerente; prévia do RDO tem `"Efetivo total"` 11.
- [ ] **Step 2:** `npx vitest run` (tudo) + integração + E2E completos → PASS.
- [ ] **Step 3:** Revisão final do branch por subagente opus (superpowers:requesting-code-review).
- [ ] **Step 4:** `git push -u origin efetivo-hh` → prévia Vercel; usuário valida.
- [ ] **Step 5:** Guiar o usuário a aplicar a migration no SQL Editor de **PROD**; `git merge --no-ff efetivo-hh` na main + push (deploy Vercel); atualizar `docs/backlog.md` (item 4 ✅) e a memória do roadmap.
