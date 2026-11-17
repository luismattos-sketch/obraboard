# Aviso de parada e "Terminei minha parte" — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O responsável avisa a parada na hora pelo link de campo (causa simples, gente, desde quando, observação, foto),
o planejador fica sabendo (faixa no app/quadro/TV + WhatsApp), a parada é encerrada e vira HH parado; e a equipe
marca "Terminei minha parte".

**Architecture:** A parada é a ocorrência `parado` de `efetivo_ocorrencias` (item 4) com `hora_fim` nula enquanto
aberta, mais observação, equipe aguardada e foto (Supabase Storage, bucket privado). `calcularHH` conta a aberta até
"agora" (telas ao vivo) ou até o fim do turno (RDO/fechamento). Registro novo `turno_equipes_terminadas`. WhatsApp é
só um link `wa.me` montado por função pura.

**Tech Stack:** Next.js 16.2 (App Router, server actions), Supabase (Postgres + RLS + Storage), React 19, Tailwind 4,
@react-pdf/renderer, Vitest 5, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-16-aviso-parada-design.md` (e a base `2026-11-16-efetivo-hh-design.md`).

## Global Constraints

- Nada de `localStorage`/`sessionStorage` no código da aplicação; foto pendente só em memória.
- Termo no app: "Responsável" (nunca "encarregado").
- Antes de usar API do Next, ler o guia em `node_modules/next/dist/docs/` (versão com mudanças).
- Arquivos do repo usam CRLF: editar preservando o fim de linha (script node de substituição se o Edit falhar).
- Testes: rodar pelo **PowerShell** com `Set-Location 'C:\Users\LuisVillaca\Documents\ObraApp'` (C maiúsculo);
  `npx vitest run <arquivo>`; integração com `$env:SUPABASE_TEST='1'`; E2E `$env:SUPABASE_TEST='1'; npx playwright test <spec>`.
- Sem psql/CLI: cada migration é aplicada pelo usuário no SQL Editor do Supabase (DEV antes dos testes de integração; PROD antes do merge).
- Foto: lado maior ≤ 1280 px, JPEG qualidade 0,7; servidor aceita ≤ 2 MB, tipos `image/jpeg`, `image/png`, `image/webp`.
- Observação da parada ≤ 500 caracteres.
- WhatsApp: `https://wa.me/<dígitos>?text=<texto>`; sem número `https://wa.me/?text=<texto>`; número sem DDI ganha `55`.
- Rótulos de causa (códigos inalterados): material "Falta material", mao_de_obra "Falta de gente", equipamento
  "Equipamento (falta ou quebra)", projeto_informacao "Falta projeto / informação", clima "Clima",
  atividade_predecessora "Aguardando outra equipe", liberacao_area "Área não liberada / interferência",
  seguranca "Segurança", outro "Outro".
- Externas: material, projeto_informacao, clima, atividade_predecessora, liberacao_area, seguranca. Internas:
  mao_de_obra, equipamento. `outro`: sem grupo.
- Nunca mostrar "avisado"/botão de WhatsApp de uma parada antes de o servidor confirmar a gravação.

## Review Focus

1. **Relógio do aparelho / horário depois do fim previsto** — parada às 17:30 num turno previsto até 17:00, sem fim
   real: deve ser aceita; antes do início do turno: recusada. (Teste na Task 4.)
2. **Dois aparelhos encerrando a mesma parada** — o 2º com outro horário recebe "Esta parada já foi encerrada às
   HH:MM"; repetição com o mesmo horário é sucesso. (Teste na Task 4.)
3. **Turno fechado entre escolher a foto e enviar** — envio recusado e nenhum arquivo fica órfão no bucket. (Task 6.)
4. **Sinal fraco ao registrar** — enquanto "Registrando…", sem "Voltamos a trabalhar"/WhatsApp; ao confirmar, aparecem.
   (Teste de componente na Task 7.)
5. **Turno aberto de outro dia no quadro** (esqueceram de fechar ontem) — parada aberta conta até o fim do turno, não
   até a hora de hoje; noturno depois da meia-noite conta até agora. (Teste na Task 3.)

---

### Task 1: Migration — parada aberta, terminados, WhatsApp da obra, bucket e fotos oficiais

**Files:**
- Create: `supabase/migrations/20261118000000_aviso_parada.sql`
- Modify: `lib/dominio/efetivoHH.ts` (tipo `Ocorrencia`, `lerOcorrencias`)
- Test: `tests/integracao/aviso-parada-banco.test.ts`

**Interfaces:**
- Produces: colunas `efetivo_ocorrencias.observacao text`, `aguardando_responsavel_id uuid`, `foto_path text`,
  `avisado_em timestamptz not null default now()`; tabela `turno_equipes_terminadas(turno_id, responsavel_id, terminou_em time, created_at)`;
  `obras.whatsapp_planejador text`; bucket `paradas`; chaves JSON `observacao`, `aguardando_responsavel_id`,
  `foto_path`, `avisado_em` em `ocorrencias_json`; chave `terminados: [{responsavel_id, terminou_em}]` em
  `foto_rdo`, `foto_checkin` e em cada turno de `foto_semana`.
- Produces (TS): `Ocorrencia` ganha `observacao: string | null; aguardando_responsavel_id: string | null;
  foto_path: string | null; avisado_em: string | null` (lidos com `?? null` por `lerOcorrencias`, então fotos antigas continuam válidas).

- [ ] **Step 1: Escrever o teste de integração (falha até a migration existir)** — `describe.skipIf(!ligado)`, padrão
  de `tests/integracao/ocorrencias.test.ts`, inserindo direto com `u.cliente`:
  - `parado` com `hora_fim: null` e causa → insere.
  - `parado` sem causa → erro `23514`.
  - `saida` com `observacao: "x"` → erro `23514` (observação/aguardando/foto só em parado).
  - `parado` com `aguardando_responsavel_id` e causa `material` → `23514` (aguardando só com `atividade_predecessora`).
  - `aguardando_responsavel_id` de responsável de outra obra → erro com `responsavel_invalido`.
  - `observacao` com 501 caracteres → `23514`.
  - `turno_equipes_terminadas`: inserir duas vezes o mesmo (turno, responsável) → `23505`; com turno fechado → erro `turno_fechado`.
  - `foto_rdo(turno)` via `rpc` com service role (`criarClienteAdmin`) contém `terminados` e as ocorrências com `observacao`.
- [ ] **Step 2: Rodar e ver falhar** — `$env:SUPABASE_TEST='1'; npx vitest run tests/integracao/aviso-parada-banco.test.ts` → FAIL (coluna inexistente).
- [ ] **Step 3: Escrever a migration**:
  - `alter table efetivo_ocorrencias add column observacao text check (observacao is null or length(observacao) <= 500)`,
    `add column aguardando_responsavel_id uuid references responsaveis(id) on delete set null`, `add column foto_path text`,
    `add column avisado_em timestamptz not null default now()`.
  - Refazer `efetivo_ocorrencias_por_tipo`: igual à atual, exceto o ramo `parado` = `causa is not null and destino_responsavel_id is null`
    (sem exigir `hora_fim`); e duas novas: `(tipo = 'parado' or (observacao is null and aguardando_responsavel_id is null and foto_path is null))`
    e `(aguardando_responsavel_id is null or causa = 'atividade_predecessora')`.
  - `tg_responsavel_mesma_obra`: no ramo `efetivo_ocorrencias`, `v_ids := array[new.responsavel_id, new.destino_responsavel_id, new.aguardando_responsavel_id]`;
    recriar o gatilho `efetivo_ocorrencias_responsavel_obra` com `update of responsavel_id, destino_responsavel_id, aguardando_responsavel_id`.
  - `turno_equipes_terminadas`: `turno_id uuid not null references turnos on delete cascade`, `responsavel_id uuid not null references responsaveis on delete cascade`,
    `terminou_em time not null`, `created_at timestamptz not null default now()`, `primary key (turno_id, responsavel_id)`;
    gatilhos `tg_bloquear_turno_fechado` (insert/update/delete) e `tg_responsavel_mesma_obra` (cai no ramo `else`, que usa `turno_id`);
    RLS/grants/policy idênticos aos de `efetivo_ocorrencias`.
  - `alter table obras add column whatsapp_planejador text check (whatsapp_planejador is null or whatsapp_planejador ~ '^[0-9]{10,15}$')`.
  - Bucket: `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('paradas','paradas',false,2097152,array['image/jpeg']) on conflict (id) do nothing;`
    sem policies para `anon`/`authenticated` (acesso só pelo servidor com service role).
  - Recriar `ocorrencias_json` com as 4 chaves novas; recriar `foto_rdo`, `foto_checkin`, `foto_semana` **a partir da
    definição em `20261116000000_efetivo_hh.sql`** acrescentando `'terminados', coalesce((select jsonb_agg(jsonb_build_object('responsavel_id', x.responsavel_id, 'terminou_em', x.terminou_em) order by x.terminou_em) from public.turno_equipes_terminadas x where x.turno_id = t.id), '[]'::jsonb)`;
    em `foto_checkin`, incluir também `aguardando_responsavel_id` na união de `responsaveis`. Manter os `revoke`/`grant` de cada função.
- [ ] **Step 4: Pedir ao usuário para aplicar a migration no SQL Editor do Supabase DEV** (guiar passo a passo).
- [ ] **Step 5: Atualizar `Ocorrencia` e `lerOcorrencias`** (4 campos novos, `?? null`) e rodar o teste → PASS; `npx vitest run tests/dominio` → PASS.
- [ ] **Step 6: Commit** — `feat(parada): migration da parada aberta, terminados, whatsapp e bucket`.

### Task 2: Causas em linguagem simples e grupo interna/externa

**Files:**
- Modify: `lib/dominio/tipos.ts`
- Test: `tests/dominio/causas.test.ts` (novo) e testes que comparam o rótulo antigo (procurar `Atividade predecessora`, `Liberação de área`, `Projeto/Informação`, `"Material"`, `"Mão de obra"` em `tests/`)

**Interfaces:**
- Produces: `CAUSAS` com os rótulos das Global Constraints; `export type GrupoCausa = "externa" | "interna"`;
  `export const GRUPO_CAUSA: Record<Causa, GrupoCausa | null>`.

- [ ] **Step 1: Teste** — `CAUSAS.atividade_predecessora === "Aguardando outra equipe"`; `GRUPO_CAUSA.material === "externa"`;
  `GRUPO_CAUSA.mao_de_obra === "interna"`; `GRUPO_CAUSA.equipamento === "interna"`; `GRUPO_CAUSA.outro === null`;
  todas as chaves de `CAUSAS` existem em `GRUPO_CAUSA`.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar.** **Step 4:** `npx vitest run tests/dominio` e ajustar os testes
  que esperavam os rótulos antigos (só o texto esperado muda) → PASS.
- [ ] **Step 5: Commit** — `feat(causas): rótulos simples e grupo interna/externa`.

### Task 3: Cálculo — parada aberta, "agora", descrições e fim padrão

**Files:**
- Modify: `lib/dominio/efetivoHH.ts`, `lib/dominio/entrada.ts`
- Test: `tests/dominio/efetivo-hh.test.ts`, `tests/dominio/parada.test.ts` (novo)

**Interfaces:**
- Consumes: `Ocorrencia` (Task 1), `CAUSAS` (Task 2).
- Produces:
  - `EntradaHH.agora?: string` ("HH:MM"). Parado com `hora_fim === null`: vai até `rel(agora)` se `agora` informado,
    senão até `D` (fim da janela). `rel` já limita à janela.
  - `horaAgoraSaoPaulo(agora?: Date): string` em `entrada.ts` ("HH:MM", fuso `America/Sao_Paulo`).
  - `agoraDoTurno(turno: { data: string; periodo: Periodo; status: StatusTurno }, hoje: string, hora: string): string | undefined`
    em `efetivoHH.ts`: `undefined` se `status === "fechado"`; `hora` se `turno.data === hoje`; `hora` se noturno e
    `turno.data` é o dia anterior a `hoje` e `hora < "12:00"`; senão `undefined`.
  - `fimPadraoParada(o: Ocorrencia, janela: Janela | null): string` — fim da janela; se a parada começou depois do fim
    (posição relativa > duração) ou sem janela, devolve `horaCurta(o.hora_inicio)`.
  - `paradasAbertas(ocorrencias: Ocorrencia[]): Ocorrencia[]` — `tipo === "parado" && hora_fim === null`, ordem de registro.
  - `descreverOcorrencia(o, nome)`: parado aberto → `"2 parados desde 10:40 · Aguardando outra equipe (Carlos)"`;
    parado encerrado → `"2 parados 10:40–13:15 · Aguardando outra equipe (Carlos)"`; equipe entre parênteses só com
    `aguardando_responsavel_id`; causa com o rótulo novo. `linhaOcorrencia` acrescenta ` — <observação>` quando houver.

- [ ] **Step 1: Testes** (em `efetivo-hh.test.ts`, mesmos ajudantes do arquivo): equipe com 2 pessoas, turno 07:00–17:00,
  intervalo 12:00–13:00, parada aberta desde 10:00:
  - sem `agora` → `hhParado = 2 × (2h + 4h) = 12` (10–12 e 13–17);
  - `agora: "11:00"` → `hhParado = 2`;
  - `agora: "18:30"` → `hhParado = 12` (limitado ao fim);
  - `agora: "09:00"` (antes do início da parada) → `hhParado = 0`;
  - todos os testes existentes do item 4 continuam passando.
  Em `parada.test.ts`: `agoraDoTurno` (fechado → undefined; mesmo dia → hora; ontem diurno → undefined; ontem noturno
  às "02:10" → "02:10"); `fimPadraoParada` (janela 07–17 → "17:00"; parada às 17:30 → "17:30"; sem janela → início);
  `descreverOcorrencia` aberta e encerrada com/sem equipe aguardada; `linhaOcorrencia` com observação;
  `horaAgoraSaoPaulo(new Date("2026-11-16T13:40:00Z")) === "10:40"`.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar.** **Step 4: Rodar** `npx vitest run tests/dominio` → PASS.
- [ ] **Step 5: Commit** — `feat(hh): parada aberta conta até agora ou até o fim do turno`.

### Task 4: Servidor — registrar parada com novos campos, encerrar e horário após o fim previsto

**Files:**
- Modify: `lib/db/validacao.ts`, `lib/db/ocorrencias.ts`, `app/t/[token]/acoes.ts`, `app/(app)/obras/[obraId]/turnos/[turnoId]/acoesExecucao.ts`
- Test: `tests/dominio/ocorrencia-validacao.test.ts`, `tests/integracao/ocorrencias.test.ts`

**Interfaces:**
- Consumes: Task 1 colunas; `fimPadraoParada` (Task 3).
- Produces:
  - `DadosOcorrencia = Omit<Ocorrencia, "created_at" | "responsavel_id" | "foto_path" | "avisado_em">` (ganha `observacao`, `aguardando_responsavel_id`).
  - `validarOcorrencia(d, janela, opcoes?: { aceitaAposFim?: boolean })`: parado aceita `hora_fim` nula; `observacao`
    aparada, vazia → null, > 500 → "Observação: máximo de 500 caracteres", só em parado; `aguardando_responsavel_id`
    UUID, só com causa `atividade_predecessora` (senão "Registro inválido"); com `aceitaAposFim`, horário depois do fim
    da janela é aceito (critério "depois do fim" × "antes do início" = mesmo de `rel` em `calcularHH`: posição relativa
    `> dur` e `< dur + (1440 − dur)/2`); antes do início continua "Horário fora do turno (…)".
  - `gravar` passa `aceitaAposFim: !t.hora_fim_real`; valida `aguardando_responsavel_id` como responsável ativo da
    mesma obra e diferente do próprio (`ERRO_MESMA_EQUIPE` → texto "Escolha outra equipe."); `mesmaOcorrencia` compara também os 2 campos novos.
  - `encerrarParadaCampo(token: string, id: string, horaFim: string, responsavelId: string | null): Promise<Resultado>` e
    `encerrarParadaPlanejador(c: SupabaseClient, turnoId: string, id: string, horaFim: string): Promise<Resultado>`:
    lê a ocorrência (do turno; no campo, da equipe quando `responsavelId !== null` — `responsavel_id` da ocorrência,
    que no recebido por empréstimo é o destino); exige `tipo === "parado"`; valida `horaFim` com a mesma regra de janela
    (com `aceitaAposFim`) e `> hora_inicio`; `update({ hora_fim }).eq("id", id).is("hora_fim", null)`; 0 linhas →
    relê: mesmo horário → `ok`; outro → `falha(\`Esta parada já foi encerrada às ${HH:MM}\`)`.
  - `encerrarAbertasDoTurno(c: SupabaseClient, turnoId: string, fins: Record<string, string>): Promise<Resultado>` —
    para cada parada aberta: `fins[id]` (validado) ou `fimPadraoParada`; grava direto (o fim padrão pode ser igual ao
    início = HH 0, sem passar pela regra "fim depois do início").
  - Server actions: campo `encerrarParada(token, id, horaFim, responsavelId)`; planejador `encerrarParadaAcao(turnoId, id, horaFim)` (via `comRevalidacao`).

- [ ] **Step 1: Testes de validação** (`ocorrencia-validacao.test.ts`): parado sem fim → ok com `hora_fim: null`;
  observação 501 → erro; observação em saída → "Registro inválido"; aguardando com causa material → "Registro inválido";
  janela 07:00–17:00: início "17:30" sem opção → "Horário fora do turno (07:00–17:00)"; com `aceitaAposFim` → ok;
  início "06:00" com `aceitaAposFim` → erro.
- [ ] **Step 2: Testes de integração** (em `ocorrencias.test.ts`, cenário existente): criar parada aberta pelo token com
  observação e aguardando Ana → lida em `obterTurnoCompleto` com os campos; aguardando de outra obra → `ERRO_RESPONSAVEL_INVALIDO`;
  encerrar "13:15" → ok e `hora_fim` gravado; encerrar de novo "13:15" → ok; encerrar "14:00" → "Esta parada já foi encerrada às 13:15";
  encerrar "09:00" (antes do início 10:40) → "O fim deve ser depois do início"; outro responsável encerrando → `ERRO_OCORRENCIA_INVALIDA`;
  parada às "17:30" com turno previsto até 17:00 e sem fim real → ok; `encerrarAbertasDoTurno` sem `fins` grava "17:00".
- [ ] **Step 3: Rodar** → FAIL. **Step 4: Implementar.** **Step 5: Rodar** os dois arquivos → PASS.
- [ ] **Step 6: Commit** — `feat(parada): registrar parada aberta e encerrar pelo campo e pelo planejador`.

### Task 5: "Terminei minha parte" e WhatsApp do planejador (servidor + domínio)

**Files:**
- Create: `lib/dominio/whatsapp.ts`, `lib/db/terminados.ts`
- Modify: `lib/db/turnos.ts` (`TurnoCompleto.terminados`), `lib/db/obras.ts` (ler/gravar `whatsapp_planejador`),
  `app/t/[token]/acoes.ts`, `app/(app)/obras/[obraId]/page.tsx` + novo `app/(app)/obras/[obraId]/WhatsappObra.tsx` e ação em `acoesIntervalo.ts` (ou arquivo vizinho)
- Test: `tests/dominio/whatsapp.test.ts`, `tests/integracao/terminados.test.ts`, `tests/integracao/obras.test.ts`

**Interfaces:**
- Produces:
  - `normalizarWhatsapp(entrada: string): Resultado<string | null>` — só dígitos; vazio → `null`; 10–11 dígitos → prefixa `55`;
    12–15 → como está; outro → "Número inválido (ex.: (11) 98888-7777)".
  - `linkWhatsapp(numero: string | null, texto: string): string`.
  - `mensagemParada(p: { obra: string; data: string; periodo: Periodo; equipe: string; o: Ocorrencia; aguardando: string | null }): string`
    → linhas `⚠ Parada — <obra> · <dd/mm> <Diurno|Noturno>`, `<equipe>: <N> <função> parados desde <HH:MM>`,
    `Motivo: <rótulo>[ (<aguardando>)]`, e `<observação>` se houver.
  - `mensagemRetomada(...)` → `✅ <equipe>: <N> <função> voltaram às <HH:MM> (parados desde <HH:MM>)`;
    `mensagemTerminou({ obra, data, periodo, equipe, hora })` → `✓ <equipe> terminou a parte dele às <HH:MM> — <obra> · <dd/mm> <período>`.
  - `TurnoCompleto.terminados: { responsavel_id: string; terminou_em: string }[]` e `TurnoCompleto.obra.whatsapp_planejador: string | null`.
  - `marcarTerminouCampo(token, responsavelId: string, hora: string): Promise<Resultado>` — insert; `23505` = ok (repetição);
    `desfazerTerminouCampo(token, responsavelId: string): Promise<Resultado>` — delete; ambos recusam turno fechado com `ERRO_FECHADO_CAMPO`.
  - `editarWhatsappObra(c, obraId, entrada: string): Promise<Resultado>`.

- [ ] **Step 1: Testes** — `whatsapp.test.ts`: `"(11) 98888-7777"` → `"5511988887777"`; `"+55 11 98888-7777"` → igual;
  `""` → `null`; `"123"` → erro; `linkWhatsapp(null, "a b")` → `"https://wa.me/?text=a%20b"`; `mensagemParada` com e sem
  aguardando/observação (texto exato). `terminados.test.ts`: marcar, marcar de novo (ok, uma linha), desfazer, turno
  fechado recusa, `obterTurnoCompleto` traz `terminados`. `obras.test.ts`: salvar e ler número; inválido recusado.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar** (UI da obra: um campo "WhatsApp do planejador" + "Salvar",
  mesmo visual de `IntervaloObra.tsx`, com texto de ajuda "Recebe os avisos de parada do campo"). **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** — `feat(parada): terminei minha parte e whatsapp do planejador`.

### Task 6: Foto da parada (servidor + redução no aparelho)

**Files:**
- Create: `lib/db/fotosParada.ts`, `lib/dominio/foto.ts`, `components/execucao/reduzirFoto.ts`
- Modify: `next.config.ts` (`experimental.serverActions.bodySizeLimit: "3mb"` — conferir `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md`),
  `lib/db/ocorrencias.ts` (remover a foto ao remover a ocorrência), `app/t/[token]/acoes.ts`, `acoesExecucao.ts`, `app/t/[token]/page.tsx`, página do turno
- Test: `tests/dominio/foto.test.ts`, `tests/integracao/fotos-parada.test.ts`

**Interfaces:**
- Produces:
  - `dimensoesReduzidas(l: number, a: number, max = 1280): { largura: number; altura: number }` (puro; nunca aumenta).
  - `reduzirFoto(arquivo: File): Promise<Blob>` (cliente: `createImageBitmap` + `<canvas>`, `toBlob("image/jpeg", 0.7)`).
  - `enviarFotoParadaCampo(token: string, ocorrenciaId: string, responsavelId: string | null, form: FormData): Promise<Resultado>`
    e `enviarFotoParadaPlanejador(c, turnoId, ocorrenciaId, form)`: campo `foto` (File); valida tipo e ≤ 2 MB
    ("Foto muito grande" / "Envie uma foto"); confere turno aberto e parada do turno (e da equipe no campo); sobe em
    `paradas/<empresa>/<obra>/<turno>/<ocorrencia>.jpg` com `upsert: true` (cliente admin); grava `foto_path`; se o
    update falhar, remove o objeto.
  - `urlsFotos(caminhos: string[]): Promise<Record<string, string>>` — URLs assinadas de 1 h (cliente admin), chave = caminho.
  - `bytesFotos(caminhos: string[]): Promise<Record<string, Uint8Array>>` — para o PDF.
  - `removerFoto(caminho: string): Promise<void>` — melhor esforço, só loga erro.
  - Páginas do campo e do turno passam `fotos: Record<string, string>` (caminho → URL) para a tela.

- [ ] **Step 1: Testes** — `foto.test.ts`: 4000×3000 → 1280×960; 800×600 → 800×600; 3000×4000 → 960×1280.
  `fotos-parada.test.ts`: enviar JPEG pequeno (Buffer de JPEG válido 1×1) → `foto_path` gravado e objeto existe;
  `image/gif` → recusado; 2,1 MB → recusado; turno fechado → recusado e nenhum objeto em `<turno>/`; remover a ocorrência →
  objeto removido; outra equipe enviando → `ERRO_OCORRENCIA_INVALIDA`.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar.** **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** — `feat(parada): foto da parada no armazenamento privado`.

### Task 7: Tela — formulário de parada, painel de paradas e "Terminei" (campo)

**Files:**
- Create: `components/execucao/FormParada.tsx`, `components/execucao/PainelParadas.tsx`, `components/execucao/BotaoTerminei.tsx`
- Modify: `components/execucao/useOcorrencias.ts`, `components/execucao/OcorrenciasEfetivo.tsx`, `components/execucao/EfetivoPorEquipe.tsx`,
  `app/t/[token]/FormularioCampo.tsx`, `app/t/[token]/page.tsx`
- Test: `tests/dominio/ocorrencias-ui.test.tsx`, `tests/dominio/paradas-ui.test.tsx` (novo)

**Interfaces:**
- Consumes: Tasks 2–6.
- Produces:
  - `useOcorrencias` ganha `encerrar(id: string, horaFim: string): Promise<void>` (otimista: `hora_fim` na tela + `pendente`;
    mesma repetição/`registrar` de `executar`; erro de negócio desfaz e mostra a mensagem) e `anexarFoto(id: string, foto: Blob): Promise<void>`
    (estado por id: `"enviando" | "falhou" | "ok"`; falha de rede repete como o resto, chave `foto-<id>`); `AcoesOcorrencias`
    ganha `encerrar` e `enviarFoto(id, form: FormData)`.
  - O hook passa a ser criado **no pai** (`FormularioCampo` e `EdicaoExecucao`) e entregue a `PainelParadas` e a
    `EfetivoPorEquipe` (nova prop `movimentacoes.estado?: ReturnType<typeof useOcorrencias>`; sem ela, `EfetivoPorEquipe` cria o seu, como hoje).
  - `montarParada(f: FormParadaDados, id: string): DadosOcorrencia | string` — exige quantidade, função, causa e "desde";
    "Já voltaram às" opcional; aguardando obrigatório se causa `atividade_predecessora` ("Escolha a equipe que vocês aguardam").
  - `FormParada` (campos do spec: quantos, função, por quê com etiqueta "externa" pelo `GRUPO_CAUSA`, equipe aguardada,
    desde = `horaAgoraSaoPaulo()`, já voltaram às (opcional), observação, foto). Substitui o ramo `parado` de `FormOcorrencia`;
    o botão "+ Parados" de `OcorrenciasEfetivo` vira "⚠ Parada" e abre `FormParada`; recebidos por empréstimo continuam
    oferecendo a parada com a função fixa.
  - `PainelParadas({ responsavelId, abertas, nome, fotos, whatsapp, contexto, encerrar, podeRegistrar, abrirForm })`:
    botão "⚠ Avisar parada" (topo, logo abaixo do horário), lista de abertas em destaque (`descreverOcorrencia`,
    observação, "📷 foto enviada"/"Enviando foto…"/"Foto não enviada · tentar de novo", miniatura pela URL),
    "Voltamos a trabalhar" (pede a hora, padrão agora) e link "Avisar no WhatsApp" (`linkWhatsapp` + `mensagemParada`).
    Pendente → texto "Registrando…" e **sem** os dois botões. Após encerrar, link de WhatsApp com `mensagemRetomada` fica
    disponível na linha até recarregar.
  - `BotaoTerminei({ terminouEm, abertasDaEquipe, marcar, desfazer, linkWhats })`: "✓ Terminei minha parte" → grava hora
    agora; com abertas, `confirm`-like inline "Encerrar também as paradas abertas às HH:MM?" (Sim/Não); depois mostra
    "✓ Você avisou que terminou às HH:MM · Desfazer" + "Avisar no WhatsApp". Substitui `"Terminou? Avise o planejador."`.
  - "Ver tudo" (`responsavelId === null`): painel só leitura das abertas; sem "Avisar parada" e sem "Terminei".
  - "Enviar turno" com parada aberta: `Aviso tom="alerta"` "Há parada sem fim; o planejador vai encerrar." (não bloqueia).
  - HH ao vivo: `calcularHH` recebe `agora` de `agoraDoTurno` (cliente, atualizado a cada minuto com `setInterval`).

- [ ] **Step 1: Testes de componente** (`renderToStaticMarkup`, padrão do arquivo existente):
  - `montarParada`: sem causa → "Informe a causa"; aguardando faltando → mensagem; "Já voltaram às" vazio → `hora_fim: null`;
    observação e aguardando passam.
  - `PainelParadas` com parada pendente → contém "Registrando…" e não contém "Voltamos a trabalhar" nem `wa.me`;
    confirmada → contém ambos e o `href` com o texto da mensagem codificado; sem `responsavelId` → sem "Avisar parada".
  - `BotaoTerminei` com `terminouEm: "15:20"` → "Você avisou que terminou às 15:20".
  - Campo com responsável não contém mais "Terminou? Avise o planejador."
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar.** **Step 4: Rodar** `npx vitest run tests/dominio` → PASS.
- [ ] **Step 5: Commit** — `feat(parada): avisar parada, voltar a trabalhar e terminei no link de campo`.

### Task 8: Planejador — faixa no turno que se atualiza sozinha e fechar com parada aberta

**Files:**
- Create: `app/(app)/obras/[obraId]/turnos/[turnoId]/FaixaParadas.tsx`
- Modify: `page.tsx`, `EdicaoExecucao.tsx`, `AcoesTurno.tsx`, `acoes.ts` (fechar), `acoesExecucao.ts`, `lib/db/turnos.ts`
- Test: `tests/dominio/acoes-turno.test.tsx`, `tests/integracao/turnos.test.ts`

**Interfaces:**
- Consumes: `encerrarAbertasDoTurno` (Task 4), `PainelParadas`/`FormParada` (Task 7), `terminados` (Task 5).
- Produces:
  - `paradasDoTurnoAcao(turnoId: string): Promise<Resultado<{ abertas: Ocorrencia[]; terminados: TurnoCompleto["terminados"] }>>`.
  - `FaixaParadas({ turnoId, inicial, responsaveis })`: cliente; a cada 30 s (só com a aba visível) chama a ação e
    re-renderiza **só a faixa** (nada de `router.refresh`); mostra paradas abertas e "✓ <equipe> terminou às HH:MM".
    Se o conjunto de abertas mudou, mostra "Atualizar números" (botão que faz `router.refresh`), sem forçar.
  - `EdicaoExecucao` usa o hook no pai (Task 7) e o `FormParada` em qualquer equipe.
  - `AcoesTurno` recebe `abertas: Ocorrencia[]` e `janela`; na confirmação lista cada aberta com `<input type="time" name="fim_<id>">`
    preenchido com `fimPadraoParada`; `fecharTurnoAcao` lê os `fim_*`, chama `encerrarAbertasDoTurno` e só então `aplicarAcao(..., "fechar")`.

- [ ] **Step 1: Testes** — `acoes-turno.test.tsx`: com 1 aberta, a confirmação contém o nome/descrição e um input com valor "17:00";
  sem abertas, nada muda. `turnos.test.ts` (integração): fechar com parada aberta e `fim_<id>=16:00` → `hora_fim` 16:00 e a versão
  oficial (`foto_rdo`) traz a parada encerrada; sem `fim_*` → 17:00.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar.** **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** — `feat(parada): faixa de paradas no turno e fechamento com parada aberta`.

### Task 9: Quadro e TV

**Files:**
- Modify: `lib/dominio/quadro.ts`, `lib/db/quadro.ts` (`terminados` na entrada e na foto do check-in), `components/quadro/Quadro.tsx`,
  `components/quadro/prepararQuadro.ts`
- Test: `tests/dominio/quadro.test.ts`, `tests/dominio/quadro-ui.test.tsx`

**Interfaces:**
- Consumes: `agoraDoTurno`, `horaAgoraSaoPaulo`, `paradasAbertas` (Task 3).
- Produces:
  - `EntradaQuadro.terminados?: { responsavel_id: string; terminou_em: string }[]`.
  - `montarQuadro(e: EntradaQuadro, agora?: string): ModeloQuadro` — passa `agora` ao `calcularHH`;
    `ModeloQuadro.paradas: { equipe: string; texto: string; desde: string; duracaoMin: number | null }[]`
    (`texto` = `descreverOcorrencia` com função: "2 Mecânico parados desde 10:40 · Aguardando outra equipe (Carlos)";
    `duracaoMin` = agora − início quando `agora` existe); `ResumoEquipe.terminouEm: string | null`.
  - `prepararQuadro` calcula `agora = agoraDoTurno(turno, hojeSaoPaulo(), horaAgoraSaoPaulo())` (não na foto do check-in).
  - `Quadro.tsx`: faixa vermelha no topo (`role="alert"`), texto ≥ `text-lg` e `xl:text-2xl`, "(2h35)" quando houver duração;
    na faixa da equipe, "✓ terminou 15:20".

- [ ] **Step 1: Testes** — `quadro.test.ts`: parada aberta 10:40 com `agora "13:15"` → `paradas[0].duracaoMin === 155` e
  com intervalo 12:00–13:00 e 2 pessoas, `hhParado` da equipe = 3,2 (2 × (80 + 15) min);
  sem `agora` → `duracaoMin === null`; `terminouEm` preenchido. `quadro-ui.test.tsx`: faixa contém "parados desde 10:40" e "(2h35)";
  equipe terminada contém "terminou 15:20"; sem paradas, sem `role="alert"`.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar.** **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** — `feat(quadro): faixa de paradas abertas e equipe que terminou`.

### Task 10: RDO — parada completa, fotos no individual, marca no lote, terminados

**Files:**
- Modify: `lib/rdo/secoes.tsx`, `lib/rdo/documento.tsx`, `lib/rdo/responder.ts`, `lib/rdo/versao.ts` (ler `terminados`), rotas em `app/api/rdo/[turnoId]` e `app/api/rdo/versao`
- Test: `tests/dominio/rdo-efetivo.test.tsx`, `tests/dominio/rdo-versao.test.ts`, `tests/integracao/rdo-versoes-leitura.test.ts`

**Interfaces:**
- Consumes: `linhaOcorrencia` (Task 3), `bytesFotos` (Task 6).
- Produces:
  - `renderizarRdo(turno, emissao, fotos?: Record<string, Uint8Array>)`; `DocumentoRdo` recebe `fotos?`.
    Com `fotos`: seção "Fotos das paradas" no fim (uma por parada com foto, largura ~300 pt, legenda = `linhaOcorrencia`).
    Sem `fotos` (lote) e parada com `foto_path`: a linha ganha " (foto no app)".
  - `respostaPdf` e `respostaVersao` carregam `bytesFotos` das ocorrências com `foto_path`; `montarLote` não carrega.
  - Seção Efetivo: "Equipes que terminaram: Rita 15:20 · João 16:05" quando houver.
  - `lerFoto` lê `terminados` (ausente → `[]`).

- [ ] **Step 1: Testes** — `rdo-efetivo.test.tsx`: texto da movimentação "João · Mecânico: 2 parados 10:40–13:15 · Aguardando outra equipe (Carlos) — rolamento 6312";
  lote sem `fotos` → contém "(foto no app)"; terminados listados. `rdo-versao.test.ts`: foto antiga sem `terminados` → `[]`.
  Integração: PDF individual com foto renderiza (buffer > 0, sem erro) e o lote de 1 turno com foto não inclui a imagem
  (tamanho próximo do sem foto).
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar.** **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** — `feat(rdo): parada com equipe aguardada, observação e fotos`.

### Task 11: E2E, verificação completa e publicação

**Files:**
- Create: `tests/e2e/aviso-parada.spec.ts` (padrão de `tests/e2e/efetivo-hh.spec.ts` e `preparar.ts`; pré-aquecer rotas com `page.request.get`)

- [ ] **Step 1: E2E** — João (link `?r=`) avisa parada: 2 Mecânico, "Aguardando outra equipe" → Carlos, desde 10:40, observação,
  foto (arquivo de teste) → aparece "Registrando…" e depois "Voltamos a trabalhar" e um link `wa.me` com "Parada"; quadro do
  planejador mostra "parados desde 10:40"; turno do planejador mostra a faixa; João encerra 13:15 → RDO (prévia) contém
  "10:40–13:15 · Aguardando outra equipe (Carlos)"; Ana toca "Terminei minha parte" → quadro mostra "terminou".
- [ ] **Step 2: Rodar** `$env:SUPABASE_TEST='1'; npx playwright test tests/e2e/aviso-parada.spec.ts` → PASS.
- [ ] **Step 3: Suite inteira** — `npx vitest run`, `$env:SUPABASE_TEST='1'; npx vitest run`, `npx playwright test`,
  `npx tsc --noEmit`, `npx eslint .` → tudo verde (anotar o flake conhecido de `programacao-banco` se aparecer).
- [ ] **Step 4: Commit** — `test(e2e): aviso de parada ponta a ponta`.
- [ ] **Step 5: Revisão final** por subagente (todo o branch contra o spec) e correções.
- [ ] **Step 6: Push do branch `aviso-parada`** (prévia Vercel) e pedir ao usuário: aplicar a migration no Supabase **PROD**,
  validar a prévia no celular (foto e WhatsApp em aparelho real). Depois do ok: `git merge --no-ff` na `main` + push (Vercel produção).
