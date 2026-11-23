# IA no campo: texto livre vira lançamento — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No link de campo, o responsável escreve "como foi o dia"; a IA (Claude Haiku 5.5) interpreta, o código confere e mostra uma prévia com até 2 perguntas de botão; nada grava até "Lançar"; o texto fica guardado e o planejador o vê.

**Architecture:** A IA só devolve JSON num esquema fixo (`output_config.format` json_schema). Uma função pura (`lib/dominio/relato.ts`) transforma essa resposta + atividades do responsável em prévia, perguntas e gravações. Gravar usa o `salvarExecucao` atual (checagem otimista `esperado` = valores vistos no Organizar → conflito vira "mudou desde a prévia"). Texto em tabela nova `relatos_campo`, escrita só pelo servidor.

**Tech Stack:** Next.js 16.2.6 (server actions), Supabase, `@anthropic-ai/sdk` (novo), vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-22-ia-texto-livre-design.md`

## Global Constraints

- Modelo: `claude-haiku-5-5` (escolha do Luis para o campo). Sem `thinking` explícito; `output_config: { effort: "low", format: { type: "json_schema", schema } }`; `max_tokens: 2000`; tempo-limite 20 s, `maxRetries: 0` (o usuário tenta de novo).
- `ANTHROPIC_API_KEY` só no servidor (`import "server-only"`). Sem chave → caixa não aparece.
- `FRENTIA_IA_FALSA=1` (testes/E2E/capturas) troca a chamada real por `lib/ia/falsa.ts`; nunca ligado em produção.
- Texto do relato: 1–1000 caracteres (trim). Observação: limite 500 (igual `efetivo_ocorrencias.observacao`/execução).
- Máximo 2 perguntas por prévia; limite de 20 tentativas por responsável por turno.
- Nunca `localStorage`/`sessionStorage` (AGENTS.md).
- Termo "Responsável", nunca "encarregado"; evitar "pleito".
- Arquivos do repo têm CRLF; editar com o Edit/Write ou node, nunca Get-Content/Set-Content.
- Testes pelo PowerShell com `Set-Location 'C:\Users\LuisVillaca\Documents\ObraApp'` (C maiúsculo).
- Antes de código Next (server actions, páginas), ler o guia em `node_modules/next/dist/docs/` correspondente.

## Review Focus

1. Texto sem nada lançável ("bom dia, tudo certo") → prévia "Não achei nada para lançar — escreva o que foi feito", sem botão Lançar. (Task 2: `semNada`.)
2. Unidade diferente da atividade ("3 peças" numa atividade em kg) → a IA não converte; o código manda para "falta" quando `unidade_dita` não bate com a unidade da atividade. (Task 2.)
3. Número com vírgula / por extenso ("2,5 m", "trinta metros") → a IA devolve número; o código aceita decimal e recusa ≤ 0 ou > 1e9. (Task 2.)
4. Atividade já concluída citada de novo ("terminamos a tubulação" com 50/50) → nada muda, item "já estava concluída". (Task 2.)
5. Responsável troca de nome no link ou o planejador remove a atividade entre Organizar e Lançar → `salvarExecucao` recusa; item mostra o erro e os demais seguem. (Task 5 teste de componente.)

---

### Task 1: Cliente da IA (real e falso)

**Files:**
- Modify: `package.json` (dependência `@anthropic-ai/sdk`)
- Create: `lib/ia/esquema.ts`, `lib/ia/cliente.ts`, `lib/ia/falsa.ts`
- Test: `tests/dominio/ia-esquema.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // lib/ia/esquema.ts (sem server-only: usado por testes e domínio)
  export type ItemIA = {
    atividade: string | null;          // código local "A1", "A2"… ou null se ambíguo
    candidatas: string[];              // códigos quando ambíguo (até 3)
    quantidade: number | null;
    unidade_dita: string | null;       // unidade como foi falada ("m", "metros", "peças")
    modo: "total" | "a_mais" | "incerto" | null;
    concluida: boolean;
    causa: Causa | null;
    causas_candidatas: Causa[];        // até 2 quando ambíguo
    coisa_da_causa: string | null;     // "andaime" (para a pergunta "andaime é…")
    trecho: string | null;             // literal do texto, para a observação
  };
  export type RespostaIA = { itens: ItemIA[] };
  export const ESQUEMA_RESPOSTA: Record<string, unknown>; // JSON Schema estrito (additionalProperties:false, required em tudo, enums de Causa e modo)
  export function lerRespostaIA(json: unknown): RespostaIA | null; // valida forma; null se inválida
  export type AtividadeParaIA = { codigo: string; descricao: string; local: string | null; unidade: string;
    meta: number | null; feito: number | null; tipo: TipoAtividade | null };
  export function montarPedido(texto: string, atividades: AtividadeParaIA[]): { system: string; user: string };
  // lib/ia/cliente.ts ("server-only")
  export function iaLigada(): boolean; // FRENTIA_IA_FALSA=1 || ANTHROPIC_API_KEY presente
  export async function interpretarRelato(texto: string, atividades: AtividadeParaIA[]):
    Promise<{ ok: true; resposta: RespostaIA } | { ok: false; motivo: "indisponivel" | "invalida" }>;
  ```

- [ ] **Step 1:** `npm install @anthropic-ai/sdk` (versão atual estável; confirmar que `messages.create` aceita `output_config.format`).
- [ ] **Step 2: testes que falham** em `tests/dominio/ia-esquema.test.ts`:
  - `lerRespostaIA` aceita `{itens:[{…completo…}]}` e devolve igual;
  - recusa (null): item sem `trecho`, `causa: "inventada"`, `modo: "x"`, `itens` não-array, `quantidade: "30"`;
  - `montarPedido("fizemos 30 m", [{codigo:"A1",descricao:"Tubulação linha 3",unidade:"m",meta:50,feito:null,…}])`: `user` contém `"A1"`, `"Tubulação linha 3"`, `"meta 50 m"` e o texto entre marcadores `<relato>`…`</relato>`; `system` contém as 9 chaves de `CAUSAS` com rótulos e a regra "nunca invente números, atividades ou causas; o que não foi dito fica null".
  - `ESQUEMA_RESPOSTA` lista em `required` todas as chaves de `ItemIA`.
- [ ] **Step 3:** rodar `npx vitest run tests/dominio/ia-esquema.test.ts` → FAIL.
- [ ] **Step 4: implementar** `esquema.ts`. O `system` em português explica: extrair só o dito; `modo` = "total" quando a fala indica o total do dia, "a_mais" quando "mais/outros", "incerto" quando não dá para saber; `concluida` só com "terminamos/concluímos/acabou"; `trecho` = cópia literal curta do motivo; extra (tipo "extra") não tem meta. Texto do usuário vai só no `user`, dentro de `<relato>`, com instrução de tratá-lo como dado.
- [ ] **Step 5: implementar** `cliente.ts`: `new Anthropic({ timeout: 20_000, maxRetries: 0 })`; `client.messages.create({ model: "claude-haiku-5-5", max_tokens: 2000, output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA_RESPOSTA } }, system, messages:[{role:"user",content:user}] })`; checar `stop_reason` (`refusal`/`max_tokens` → `invalida`); juntar blocos `text`, `JSON.parse`, `lerRespostaIA`. Erros do SDK (`Anthropic.APIError`, conexão, timeout) → `indisponivel`, com `console.error` sem o texto do usuário. Com `FRENTIA_IA_FALSA=1` chama `falsa.ts`.
- [ ] **Step 6: implementar** `falsa.ts` `respostaFalsa(texto, atividades): RespostaIA` determinística para os testes: reconhece `(\d+(,\d+)?) ?m de (\w+)` → item da 1ª atividade cuja descrição contém a palavra, `modo:"incerto"` se `feito>0` senão `"total"`; "faltou andaime" → `causas_candidatas:["material","equipamento"]`, `coisa_da_causa:"andaime"`, `trecho:"faltou andaime"`; texto contendo "ERRO" → lança (simula indisponível).
- [ ] **Step 7:** vitest do arquivo → PASS; `npx tsc --noEmit` limpo.
- [ ] **Step 8: commit** `feat(ia): cliente Claude com esquema fixo e versão falsa para testes`.

### Task 2: Conferência e prévia (função pura)

**Files:**
- Create: `lib/dominio/relato.ts`
- Test: `tests/dominio/relato.test.ts`

**Interfaces:**
- Consumes: `RespostaIA`, `ItemIA` (Task 1); `CAUSAS`, `Causa`, `AtividadeExec`; `statusAtividade` (`lib/dominio/calculos.ts`); `numeroBR`.
- Produces:
  ```ts
  export type AtividadeRelato = AtividadeExec & { unidade: string; local: string | null };
  export function codigosParaIA(atividades: AtividadeRelato[]): Map<string, AtividadeRelato>; // "A1".. na ordem recebida
  export type Pergunta =
    | { tipo: "atividade"; chave: string; texto: string; opcoes: { id: string; rotulo: string }[] }
    | { tipo: "causa"; chave: string; atividadeId: string; texto: string; opcoes: { causa: Causa; rotulo: string }[] }
    | { tipo: "modo"; chave: string; atividadeId: string; texto: string; somar: number; trocar: number }
    | { tipo: "quantidade"; chave: string; atividadeId: string; texto: string; tudo: number | null };
  export type ItemPrevia = { atividadeId: string; titulo: string; antes: DadosExecucao; depois: DadosExecucao;
    linha: string; pendenteDe: string[] /* chaves de pergunta */ };
  export type Previa = { itens: ItemPrevia[]; perguntas: Pergunta[]; faltas: string[]; semCitar: string[]; semNada: boolean };
  export function conferirRelato(resposta: RespostaIA, atividades: AtividadeRelato[]): Previa;
  export type Respostas = Record<string /* chave */, string | number /* id | causa | "somar"|"trocar" | número */>;
  export function aplicarRespostas(previa: Previa, respostas: Respostas):
    { gravar: { atividadeId: string; dados: DadosExecucao; esperado: DadosExecucao }[]; faltam: string[] };
  ```

- [ ] **Step 1: testes que falham** (`relato.test.ts`), com atividades `T` = Tubulação linha 3 (m, meta 50, feito null) e `S` = Suporte de tubo (un, meta 8):
  - "30 m, faltou andaime" (candidatas material/equipamento) → item T `depois.qtd_realizada=30`, `linha` = `"Tubulação linha 3 — 0 → 30 m de 50 m (parcial)"`; 1 pergunta `causa` texto `"Andaime é…"` com rótulos `"Falta material"`, `"Equipamento (falta ou quebra)"` e opção `outro` `"Outra"`; `semCitar` = `["Suporte de tubo"]`.
  - `aplicarRespostas` com causa `"material"` → `gravar[0].dados` = `{qtd_realizada:30, causa:"material", observacao:"faltou andaime"}`, `esperado` = valores antes.
  - Feito 40 + `modo:"incerto"` + 30 → pergunta `modo` texto `"30 m a mais ou no total?"`, `somar:70`, `trocar:30`.
  - `modo:"a_mais"` com feito 40 → 70 sem pergunta.
  - Sem número e sem concluída → pergunta `quantidade` `"Quanto de Tubulação linha 3?"` com `tudo:50`; para extra (`tipo:"extra"`) `tudo:null`.
  - `atividade:null` + 2 candidatas → pergunta `atividade` com as duas.
  - Três dúvidas → só 2 perguntas (ordem: atividade, causa, modo, quantidade); a 3ª vira `faltas` e o item dela não entra em `gravar`.
  - Código inexistente ("A9"), causa fora da lista, quantidade ≤ 0 ou > 1e9, `unidade_dita` que não bate (`"peças"` em `kg`; aceitar sinônimos `m/metro/metros`, `un/unidade/unidades/peça/peças` quando a unidade da atividade é `un`, comparação sem acento e minúscula) → `faltas` com o nome da atividade, nada gravado dela.
  - `concluida:true` → `qtd_realizada = meta`, causa `null`; atividade já concluída → item `linha` `"… já estava concluída"`, não entra em `gravar`.
  - Causa em extra/adiantada → ignorada (sem pergunta de causa).
  - Observação: anterior `"x"` + trecho → `"x · faltou andaime"`; se passar de 500 → observação não muda e `faltas` ganha `"Suporte…: observação grande demais — complete no card"`.
  - `{itens:[]}` → `semNada:true`.
  - `aplicarRespostas` com pergunta sem resposta → `faltam` contém a chave e o item dela fora de `gravar`.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3: implementar** `conferirRelato` e `aplicarRespostas`. Causa só é aplicada se o `depois` ficar não concluído e a atividade não for extra/adiantada (mesma regra `!a.tipo` dos cards). Números com `Math.round(x*1000)/1000`.
- [ ] **Step 4:** rodar → PASS.
- [ ] **Step 5: commit** `feat(dominio): conferência do relato da IA e prévia com perguntas`.

### Task 3: Tabela `relatos_campo` e funções de banco

**Files:**
- Create: `supabase/migrations/20261122000000_relatos_campo.sql`, `lib/db/relatos.ts`
- Modify: `lib/db/mensagens.ts` (mensagens novas)
- Test: `tests/integracao/relatos.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Relato = { id: string; responsavel_id: string; texto: string; tentativas: number; lancado: boolean;
    criado_em: string; atualizado_em: string };
  export const LIMITE_TENTATIVAS = 20;
  // server-only, admin; turnoId já resolvido pelo token
  export async function gravarTentativa(turnoId: string, responsavelId: string, texto: string, relatoId: string | null):
    Promise<Resultado<{ id: string; tentativas: number }>>; // relatoId de relato lancado ou de outro responsável → cria novo
  export async function marcarLancado(turnoId: string, responsavelId: string, relatoId: string): Promise<Resultado>;
  export async function relatoPendente(turnoId: string, responsavelId: string): Promise<Relato | null>; // último não lançado
  // sessão (RLS) — planejador
  export async function relatosDoTurno(c: SupabaseClient, turnoId: string): Promise<Relato[]>; // mais recente primeiro
  ```
  Mensagens: `ERRO_LIMITE_IA = "Limite de uso da IA neste turno — lance nos cards."`, `ERRO_RELATO_TAMANHO = "Escreva até 1.000 caracteres."`.

- [ ] **Step 1: migration**: tabela (`id uuid pk default gen_random_uuid()`, `turno_id` fk cascade, `responsavel_id` fk `responsaveis` cascade, `texto text not null check (length between 1 and 1000)`, `tentativas int not null default 1 check (tentativas >= 1)`, `lancado bool not null default false`, `criado_em`/`atualizado_em timestamptz default now()`), índice `(turno_id, responsavel_id)`, gatilhos `tg_bloquear_turno_fechado` e `tg_responsavel_mesma_obra` (como `turno_equipes_terminadas`), RLS ligada, `revoke all … from anon, authenticated`, `grant select … to authenticated`, `grant all … to service_role`, policy só `for select` com `eh_membro(o.empresa_id)`. Conferir que `tg_responsavel_mesma_obra` trata a tabela nova (se a função ramifica por `tg_table_name`, incluir o ramo).
- [ ] **Step 2:** guiar o Luis para rodar a migration no **Supabase DEV** pelo SQL Editor (dizer o projeto em destaque).
- [ ] **Step 3: testes de integração que falham** (`SUPABASE_TEST=1`): cria → `tentativas 1`; mesma id → atualiza texto e `tentativas 2`; após `marcarLancado`, `gravarTentativa(…, idAntigo)` cria linha nova; 21ª tentativa somando linhas do responsável no turno → `ERRO_LIMITE_IA`; texto 1001 → `ERRO_RELATO_TAMANHO`; `relatoPendente` devolve o último não lançado; usuário de outra empresa lê 0 linhas; usuário dono lê; `authenticated` não consegue inserir; turno fechado recusa gravar.
- [ ] **Step 4:** rodar `$env:SUPABASE_TEST='1'; npx vitest run tests/integracao/relatos.test.ts` → FAIL; implementar `relatos.ts`; → PASS.
- [ ] **Step 5: commit** `feat(db): relatos_campo guarda o texto do campo`.

### Task 4: Ações do link de campo

**Files:**
- Modify: `app/t/[token]/acoes.ts`, `lib/db/campo.ts` (função `organizarRelatoCampo`, `lancarRelatoCampo`)
- Test: `tests/integracao/relatos.test.ts` (com `FRENTIA_IA_FALSA=1`)

**Interfaces:**
- Consumes: Tasks 1–3; `turnoAberto`, `obterTurnoCompleto`.
- Produces (server actions):
  ```ts
  export async function organizarRelato(token: string, responsavelId: string, texto: string, relatoId: string | null):
    Promise<Resultado<{ relatoId: string; previa: Previa }>>;
  export async function lancarRelato(token: string, responsavelId: string, relatoId: string): Promise<Resultado>;
  ```
  Mensagem `ERRO_IA_INDISPONIVEL = "Não deu para organizar agora — tente de novo ou lance nos cards."`.

- [ ] **Step 1: testes que falham**: `organizarRelatoCampo` com texto "fizemos 30 m de tubulação, faltou andaime" e atividade "Tubulação" do responsável → `previa.itens[0].depois.qtd_realizada = 30` e relato gravado; atividade de outro responsável nunca aparece na prévia; responsável que não é da obra → `ERRO_RESPONSAVEL_INVALIDO`; texto com "ERRO" → `ERRO_IA_INDISPONIVEL` e o relato **continua gravado**; token inválido → `ERRO_LINK`; `lancarRelatoCampo` marca `lancado`.
- [ ] **Step 2:** implementar: valida token (`turnoAberto`), texto (trim, 1–1000), responsável no turno; `gravarTentativa` **antes** da IA; carrega atividades do responsável (servidor, nunca do cliente), `codigosParaIA` → `interpretarRelato` → `conferirRelato`. Sem `iaLigada()` → `ERRO_IA_INDISPONIVEL`.
- [ ] **Step 3:** rodar → PASS.
- [ ] **Step 4: commit** `feat(campo): ações organizar e lançar relato`.

### Task 5: Caixa "Conte como foi o dia" no link de campo

**Files:**
- Create: `components/execucao/ContarDia.tsx`
- Modify: `app/t/[token]/FormularioCampo.tsx` (props `iaLigada`, `relatoPendente`), `app/t/[token]/page.tsx` (busca `iaLigada()` e `relatoPendente`)
- Test: `tests/dominio/contar-dia.test.tsx`

**Interfaces:**
- Consumes: `organizarRelato`, `lancarRelato` (Task 4), `salvarExecucao` (existente), `Registrar` de `rastreioSalvamento`, `decidirRepeticao`.
- Produces:
  ```tsx
  export function ContarDia(props: {
    textoInicial: string; relatoIdInicial: string | null;
    organizar: (texto: string, relatoId: string | null) => Promise<Resultado<{ relatoId: string; previa: Previa }>>;
    salvar: (atividadeId: string, dados: DadosExecucao, esperado: DadosExecucao) => Promise<Resultado<ValoresExecucao>>;
    marcarLancado: (relatoId: string) => Promise<Resultado>;
    aoLancar: () => void; // router.refresh()
  }): JSX.Element;
  ```

- [ ] **Step 1: testes de componente que falham** (organizar/salvar falsos):
  - título "Conte como foi o dia", textarea com `textoInicial`, dica "Dá para ditar pelo microfone do teclado.";
  - "Organizar" → "Organizando…" → "A IA entendeu:" com as `linha`s, `semCitar` como "<nome> — você não falou nada (fica como está)", `faltas` como "Falta: …";
  - "Lançar" desabilitado até responder as perguntas; tocar botão da pergunta habilita;
  - "Corrigir texto" volta à caixa com o texto, sem chamar `salvar`;
  - "Lançar" chama `salvar` uma vez por item de `gravar` com o `esperado`, depois `marcarLancado` e `aoLancar`; caixa limpa com "Lançado ✓";
  - `salvar` devolvendo conflito → item "mudou desde a prévia — organize de novo"; outro erro (ex.: `ERRO_ATIVIDADE`) → mensagem no item; demais seguem;
  - falha de rede em `salvar` (rejeita) → registra `"falhou"` no `Registrar` e tenta de novo pela `decidirRepeticao` (timers falsos);
  - `organizar` falhando → aviso `ERRO_IA_INDISPONIVEL`, texto continua na caixa;
  - `semNada` → "Não achei nada para lançar — escreva o que foi feito." e sem "Lançar".
- [ ] **Step 2:** rodar → FAIL; implementar (botões com o estilo de `Botao`, aviso com `Aviso`); → PASS.
- [ ] **Step 3:** ligar em `FormularioCampo`: acima de `BlocoAtividades`, só se `iaLigada && !somenteLeitura && responsavelId !== null && atividades da pessoa > 0`.
- [ ] **Step 4:** `npx vitest run` inteiro e `npx tsc --noEmit` → verdes.
- [ ] **Step 5: commit** `feat(campo): caixa Conte como foi o dia com prévia e perguntas`.

### Task 6: Planejador vê o que o campo escreveu

**Files:**
- Create: `app/(app)/obras/[obraId]/turnos/[turnoId]/RelatosCampo.tsx`
- Modify: `app/(app)/obras/[obraId]/turnos/[turnoId]/page.tsx`
- Test: `tests/dominio/relatos-campo-ui.test.tsx`

**Interfaces:** Consumes `relatosDoTurno` (Task 3), `listarResponsaveis`.

- [ ] **Step 1: teste que falha**: sem relatos → não renderiza nada; com relatos → `Expansivel` fechado "O que o campo escreveu (2)"; cada linha: nome do responsável, hora (`HH:MM` SP), texto e selo "lançado"/"não lançado".
- [ ] **Step 2:** implementar e colocar abaixo da lista de atividades da página do turno; → PASS.
- [ ] **Step 3: commit** `feat(turno): planejador vê o texto do campo`.

### Task 7: E2E, manual, capturas e Novidades

**Files:**
- Create: `tests/e2e/contar-dia.spec.ts`
- Modify: `playwright.config.ts` (`webServer.env: { FRENTIA_IA_FALSA: "1" }` — conferir que não quebra quem roda `npm run dev` à parte; documentar em comentário), `lib/ajuda/conteudo/campo.ts` (seção `contar-dia`), "Como usar" do campo, `tests/manual/capturas.spec.ts` (passo com `alvo` na caixa), `lib/ajuda/novidades.ts`, `docs/backlog.md`

- [ ] **Step 1: E2E que falha**: planejador cria turno com "Tubulação linha 3" (m, 50) para Ana; celular abre o link, escolhe Ana, escreve "fizemos 30 m de tubulação, faltou andaime", Organizar, toca "Falta material", Lançar → card mostra total 30 e causa Falta material após recarregar; planejador vê "O que o campo escreveu" com o texto e "lançado". Segundo caso: texto com "ERRO" → aviso e texto preservado após recarregar a página.
- [ ] **Step 2:** rodar `$env:SUPABASE_TEST='1'; npx playwright test tests/e2e/contar-dia.spec.ts` → PASS (matar `next dev` antigo na porta 3000 antes).
- [ ] **Step 3:** manual: seção "Contar o dia com a IA" (o que escrever, que nada grava sem Lançar, as perguntas, que sem sinal o texto fica guardado); Novidades `2026-11-22` "Conte como foi o dia: escreva ou dite e a IA organiza o lançamento para você conferir." → `/ajuda/campo#contar-dia`. Fluxograma não muda (atalho).
- [ ] **Step 4:** `SUPABASE_TEST=1 MANUAL_CAPITULO=campo npm run manual:capturas` e testes `ajuda-*` → verdes.
- [ ] **Step 5:** suíte completa: `npx vitest run`, `SUPABASE_TEST=1 npx vitest run`, `SUPABASE_TEST=1 npx playwright test`, `npm run build`.
- [ ] **Step 6: commit** `docs(ajuda): contar o dia com a IA` + `test(e2e): contar o dia`.

### Task 8: Teste com a IA real, revisão e publicação

- [ ] **Step 1:** com a chave do `.env.local` (sem `FRENTIA_IA_FALSA`), rodar um script em scratchpad que chama `interpretarRelato` + `conferirRelato` com 8 frases de canteiro (ex.: "fizemos 30 m de tubulação, faltou andaime"; "a linha da caldeira foi uns 30, ficou faltando o andaime"; "terminamos os suportes"; "não deu pra fazer nada, choveu"; "mais 10 metros de tubo"; "bom dia"; "soldamos 3 juntas"; "ficamos esperando a elétrica liberar") e conferir a prévia de cada uma; ajustar o `system` se a IA inventar. Mostrar o resultado ao Luis.
- [ ] **Step 2:** revisão final do branch por subagente (opus) e correções.
- [ ] **Step 3:** `git push -u origin ia-texto-livre` → prévia Vercel; Luis valida no celular.
- [ ] **Step 4:** guiar a migration no **Supabase PROD**; merge `--no-ff` na `main` + push (Vercel produção); planilha "Backlog Frentia" 10.1/10.2 → Feito; memória atualizada.
