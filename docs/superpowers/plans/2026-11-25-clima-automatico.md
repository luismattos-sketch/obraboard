# Clima automático no RDO — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O clima de cada turno passa a vir sozinho do Open-Meteo (cidade da obra, janela do turno, leitura de 2 em 2h) e o clima manual sai do app.

**Architecture:** Lógica pura em `lib/clima/montar.ts` (janela, amostragem, resumo, rótulos WMO); acesso HTTP isolado em `lib/clima/openmeteo.ts` com modo falso (`FRENTIA_CLIMA_FALSO=1`, como `FRENTIA_IA_FALSA`). O resultado do turno é gravado numa linha de `clima_turno` (resumo + leituras em jsonb) dentro de `aplicarAcao` no enviar/fechar, antes da troca de status, para entrar no retrato `foto_rdo`. Telas mostram o gravado ou, em campo, a consulta ao vivo com cache.

**Tech Stack:** Next.js 16 (ler `node_modules/next/dist/docs/` antes de usar `fetch` com cache), Supabase (Postgres + RLS), @react-pdf/renderer, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-25-clima-automatico-design.md`

## Global Constraints
- Nunca `localStorage`/`sessionStorage`.
- Nenhum teste chama o Open-Meteo real: unidade com `fetch` dublê (`vi.stubGlobal`), integração/e2e/capturas com `FRENTIA_CLIMA_FALSO=1`.
- Falha do serviço de clima **nunca** bloqueia enviar/fechar nem quebra página: loga (`console.error`) e segue.
- Nunca gravar hora posterior a "agora" no fuso da obra (`utc_offset_seconds` da resposta).
- Tempo limite das chamadas: 5 s (`AbortSignal.timeout(5000)`).
- URLs em variáveis com padrão: `OPEN_METEO_URL` (padrão `https://api.open-meteo.com/v1/forecast`), `OPEN_METEO_GEO_URL` (padrão `https://geocoding-api.open-meteo.com/v1/search`).
- Texto do app em pt-BR; quem assume atividades é "Responsável", nunca "encarregado".
- Testes: PowerShell com cwd `C:\Users\...` (C maiúsculo); integração com `$env:SUPABASE_TEST='1'`.
- Migrações aplicadas no Supabase de teste com `npx supabase db push`, como nas anteriores.

## Decisões deste plano (ajustes ao spec, dentro do que ele deixou ao builder)
- Resumo e leituras numa só tabela `clima_turno` (1 linha por turno, `leituras jsonb`) em vez de `clima_leituras` + resumo: gravação atômica e não passa pelos triggers de `turnos`.
- Rótulo do código 0 é "Céu limpo" (não "Sol"), porque há turno noturno.
- "Choveu" quando a chuva total da janela ≥ 0,5 mm; abaixo disso "Não choveu" (resíduo de modelo não conta).
- Cidade obrigatória na **tela** de nova obra (`novaObra`); `criarObra` aceita cidade opcional, para não quebrar fixtures de teste.

## Review Focus
- Turno noturno 19:00–05:00: janela atravessa a meia-noite e pede ao Open-Meteo dois dias → teste em Task 1 e Task 2.
- Enviar manual às 14:00 de um turno 07–17 sem fim real: grava só até 14:00 → teste em Task 1 (`agoraLocal`) e Task 3.
- Open-Meteo fora do ar / resposta com `null` nas horas: fechar funciona e o RDO diz "Clima não disponível" → teste em Task 2 e Task 3.
- Obra sem cidade (dados de teste antigos): enviar/fechar não tentam buscar, tela mostra aviso com link → teste em Task 3 e Task 5.
- Busca de cidade com 1 letra ou sem resultado: não chama o serviço (<2 caracteres) / mostra "Nenhuma cidade encontrada" → teste em Task 4.

---

### Task 1: Domínio do clima (funções puras)

**Files:**
- Create: `lib/clima/tipos.ts`, `lib/clima/montar.ts`
- Test: `tests/dominio/clima.test.ts`

**Interfaces:**
- Produces (`lib/clima/tipos.ts`):
  ```ts
  export type HoraClima = { hora: string /* "YYYY-MM-DDTHH:00", hora local da obra */; temperatura: number; chuva_mm: number; codigo: number };
  export type ClimaTurno = { temp_media: number; temp_max: number; temp_min: number; chuva_mm: number; choveu: boolean; leituras: HoraClima[] };
  export type JanelaClima = { inicio: string; fim: string }; // "YYYY-MM-DDTHH:MM", local
  export type Cidade = { nome: string; latitude: number; longitude: number };
  ```
- Produces (`lib/clima/montar.ts`):
  - `janelaDoTurno(t: { data: string; hora_inicio_real: string | null; hora_fim_real: string | null; hora_inicio_prevista: string | null; hora_fim_prevista: string | null }): JanelaClima | null` — real senão previsto; `null` se faltar início ou fim; fim ≤ início ⇒ fim no dia seguinte.
  - `agoraLocal(agora: Date, utcOffsetSeconds: number): string` — "YYYY-MM-DDTHH:MM".
  - `montarClima(horas: HoraClima[], janela: JanelaClima, agora: string): ClimaTurno | null` — usa as horas cheias de `floor(inicio)` até `min(floor(fim), floor(agora))`; resumo com todas elas (média/máx/mín com 1 casa, chuva somada com 1 casa, `choveu = chuva_mm >= 0.5`); `leituras` = a cada 2h a partir da primeira, sempre incluindo a última; `null` se nenhuma hora.
  - `rotuloTempo(codigo: number): string` — 0 "Céu limpo"; 1–2 "Poucas nuvens"; 3 "Nublado"; 45, 48 "Neblina"; 51–57 "Garoa"; 61, 66, 80 "Chuva fraca"; 63, 81 "Chuva"; 65, 67, 82 "Chuva forte"; 71–77, 85, 86 "Neve"; 95–99 "Tempestade"; outro "—".

- [ ] **Step 1: Write the failing tests** em `tests/dominio/clima.test.ts`:
  - `janelaDoTurno` diurno previsto `{data:"2026-11-25", prev 07:00:00–17:30:00, reais null}` → `{inicio:"2026-11-25T07:00", fim:"2026-11-25T17:30"}`; real presente prevalece; noturno 19:00–05:00 → fim `"2026-11-26T05:00"`; sem fim → `null`.
  - `agoraLocal(new Date("2026-11-25T17:10:00Z"), -10800)` → `"2026-11-25T14:10"`.
  - `montarClima` com horas 06..18 (temperatura = hora, chuva 2 mm às 13 e 14, 0 nas demais, código 0 exceto 61 às 13 e 14), janela 07:00–17:30, agora `"2026-11-25T20:00"` → leituras nas horas `07,09,11,13,15,17`; `temp_media 12`, `temp_max 17`, `temp_min 7`, `chuva_mm 4`, `choveu true`.
  - mesma série, janela 07:00–16:00 → últimas leituras `15,16`.
  - mesma série, agora `"2026-11-25T14:10"` → leituras `07,09,11,13,14` (a última hora entra), `temp_max 14`.
  - chuva total 0,3 → `choveu false`; agora antes do início → `null`.
  - noturno 19:00–05:00 com horas dos dois dias → primeira leitura `"…25T19:00"`, última `"…26T05:00"`.
  - `rotuloTempo(0)` "Céu limpo", `(63)` "Chuva", `(95)` "Tempestade", `(4)` "—".
- [ ] **Step 2: Run** `npx vitest run tests/dominio/clima.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3: Implement** os tipos e as quatro funções acima (comparação de horas como strings ISO locais; sem `Date` com fuso no cálculo da janela).
- [ ] **Step 4: Run** o mesmo comando → PASS; `npx tsc --noEmit`.
- [ ] **Step 5: Commit** `feat(clima): janela do turno, leituras de 2 em 2h e resumo`.

### Task 2: Cliente Open-Meteo (real e falso)

**Files:**
- Create: `lib/clima/openmeteo.ts`, `lib/clima/falso.ts`, `lib/clima/obter.ts`
- Test: `tests/dominio/clima-openmeteo.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `buscarHoras(lat: number, lon: number, dataInicio: string, dataFim: string, opcoes?: { revalidar?: number }): Promise<{ horas: HoraClima[]; utcOffsetSeconds: number } | null>` — GET `OPEN_METEO_URL` com `latitude, longitude, hourly=temperature_2m,precipitation,weather_code, timezone=auto, start_date, end_date`; descarta horas com algum valor `null`; `revalidar` vira o cache de `fetch` do Next; erro/timeout/HTTP≠200 ⇒ `null` + `console.error`. Nunca lança.
  - `buscarCidades(termo: string): Promise<Cidade[]>` — termo com trim < 2 caracteres ⇒ `[]` sem chamar; GET `OPEN_METEO_GEO_URL` com `name, count=6, language=pt, countryCode=BR`; `nome = "${name}, ${admin1}"` (só `name` se não houver `admin1`); erro ⇒ `[]`.
  - `obterClimaTurno(obra: { latitude: number | null; longitude: number | null }, turno: Parameters<typeof janelaDoTurno>[0], opcoes?: { agora?: Date; revalidar?: number }): Promise<ClimaTurno | null>` — sem coordenadas ou sem janela ⇒ `null` sem chamar; pede do dia do início ao dia do fim; aplica `montarClima` com `agoraLocal(agora, utcOffsetSeconds)`.
  - Modo falso (`process.env.FRENTIA_CLIMA_FALSO === "1"`): `buscarHoras` devolve série determinística para cada hora dos dias pedidos (temperatura `22 + (h % 12)`, chuva 1,5 mm às 13h e 14h, código 61 nessas horas e 1 nas demais, offset −10800); `buscarCidades` filtra (sem acento, minúsculas) a lista fixa `Macaé, Rio de Janeiro (-22.37, -41.79)`, `Rio de Janeiro, Rio de Janeiro (-22.91, -43.18)`, `São Paulo, São Paulo (-23.55, -46.64)`.

- [ ] **Step 1: Write the failing tests** com `vi.stubGlobal("fetch", …)` e `vi.stubEnv`:
  - resposta Open-Meteo de exemplo (2 horas, uma com `temperature_2m: null`) ⇒ 1 hora; a URL chamada contém `timezone=auto` e `start_date=2026-11-25`.
  - `fetch` rejeita ⇒ `null`; status 500 ⇒ `null`.
  - `buscarCidades("M")` ⇒ `[]` e `fetch` não chamado; resposta com `{name:"Macaé", admin1:"Rio de Janeiro"}` ⇒ `nome "Macaé, Rio de Janeiro"`; resposta sem `results` ⇒ `[]`.
  - `obterClimaTurno` sem coordenadas ⇒ `null` sem `fetch`; turno noturno 19:00–05:00 de 25/11 ⇒ chama com `end_date=2026-11-26`.
  - modo falso: `buscarCidades("mace")` ⇒ Macaé; `obterClimaTurno` diurno 07–17 com `agora` no dia seguinte ⇒ `choveu true`, 6 leituras.
- [ ] **Step 2: Run** `npx vitest run tests/dominio/clima-openmeteo.test.ts` → FAIL.
- [ ] **Step 3: Implement** os três arquivos (`falso.ts` sem uso em produção, cabeçalho como `lib/ia/falsa.ts`).
- [ ] **Step 4: Run** → PASS; `npx tsc --noEmit`.
- [ ] **Step 5: Commit** `feat(clima): cliente Open-Meteo com tempo limite e modo falso`.

### Task 3: Banco, gravação no enviar/fechar e retrato do RDO

**Files:**
- Create: `supabase/migrations/20261202000000_clima_automatico.sql`, `lib/db/clima.ts`
- Modify: `lib/db/obras.ts` (tipo `Obra` + `COLUNAS`), `lib/db/turnos.ts` (`TurnoCompleto`, select de `obterTurnoCompleto`, `aplicarAcao`), `lib/rdo/versao.ts` (`FotoV1`, `lerFoto`)
- Test: `tests/integracao/clima-turno.test.ts`, `tests/dominio/rdo-versao.test.ts`

**Interfaces:**
- Consumes: `obterClimaTurno` (Task 2), `ClimaTurno` (Task 1).
- Produces:
  - Colunas `obras.local_nome text`, `obras.latitude double precision`, `obras.longitude double precision` (nulas; check lat ∈ [−90, 90], lon ∈ [−180, 180], ambas nulas ou ambas preenchidas).
  - Tabela `clima_turno (turno_id uuid pk references turnos on delete cascade, temp_media numeric, temp_max numeric, temp_min numeric, chuva_mm numeric, choveu boolean, leituras jsonb not null, buscado_em timestamptz not null default now())`; RLS igual à antiga `clima` (membro da empresa da obra); trigger `clima_turno_bloquear_fechado` com `tg_bloquear_turno_fechado`; grants como `clima`.
  - `foto_rdo` redefinida: obra ganha `local_nome`; chave `clima` **sai**; nova chave `clima_turno` (objeto ou `null`) com os campos acima menos `turno_id`/`buscado_em`.
  - `Obra` ganha `local_nome?: string | null; latitude?: number | null; longitude?: number | null`.
  - `TurnoCompleto` ganha `clima_turno: ClimaTurno | null` (o campo `clima` antigo continua até a Task 5).
  - `gravarClimaTurno(c: SupabaseClient, turno: TurnoCompleto): Promise<void>` — `obterClimaTurno(turno.obra, turno)`; resultado ⇒ upsert em `clima_turno`; `null` ⇒ não apaga o que existe; nunca lança.
  - Em `aplicarAcao`, depois de `transicaoTurno` ok e antes do `update`: se `acao` é `"enviar"` ou `"fechar"`, `await gravarClimaTurno(c, turno)`.

- [ ] **Step 1: Write the failing tests** (`SUPABASE_TEST=1`, `vi.stubEnv("FRENTIA_CLIMA_FALSO","1")`, fixtures como em `tests/integracao/terminados.test.ts`):
  - obra com cidade, turno 07–17 de ontem em campo ⇒ `aplicarAcao(...,"enviar")` grava `clima_turno` com 6 leituras e `choveu true`; `obterTurnoCompleto` devolve `clima_turno` preenchido.
  - fechar ⇒ a última `rdo_versoes.dados.clima_turno` tem as mesmas leituras; `dados` não tem chave `clima`.
  - obra sem cidade ⇒ fechar dá ok e `dados.clima_turno` é `null`.
  - modo falso desligado + `fetch` rejeitando ⇒ fechar dá ok, `clima_turno` `null`.
  - turno de hoje enviado com `agora` simulado (`vi.setSystemTime` 14:10 local) e sem fim real ⇒ última leitura ≤ 14:00.
  - escrever em `clima_turno` de turno fechado ⇒ erro `turno_fechado`.
  - `tests/dominio/rdo-versao.test.ts`: foto com `clima_turno` ⇒ `lerFoto` devolve o objeto; foto antiga só com `clima` ⇒ `clima_turno: null`.
- [ ] **Step 2: Run** `npx vitest run tests/integracao/clima-turno.test.ts tests/dominio/rdo-versao.test.ts` → FAIL.
- [ ] **Step 3: Write the migration, apply it** (`npx supabase db push`) **and implement** `lib/db/clima.ts`, os ajustes em `obras.ts`, `turnos.ts` (select acrescenta `local_nome, latitude, longitude` na obra e `clima_turno(temp_media, temp_max, temp_min, chuva_mm, choveu, leituras)`; numéricos com `Number()`) e `versao.ts`.
- [ ] **Step 4: Run** → PASS; `npx vitest run` (com `SUPABASE_TEST=1`) sem regressões; `npx tsc --noEmit`.
- [ ] **Step 5: Commit** `feat(clima): grava o clima do turno no enviar/fechar e no retrato do RDO`.

### Task 4: Cidade da obra

**Files:**
- Create: `components/obra/EscolherCidade.tsx`, `app/(app)/obras/[obraId]/CidadeObra.tsx`, `app/(app)/obras/acoesCidade.ts`
- Modify: `lib/db/obras.ts` (`criarObra`, nova `editarCidadeObra`, `errosObra`), `lib/db/validacao.ts`, `app/(app)/obras/acoes.ts`, `app/(app)/obras/nova/formulario.tsx`, `app/(app)/obras/[obraId]/page.tsx`
- Test: `tests/dominio/cidade.test.ts`, `tests/integracao/obras.test.ts`

**Interfaces:**
- Consumes: `buscarCidades`, `Cidade`.
- Produces:
  - `validarCidade(c: unknown): Resultado<Cidade>` em `validacao.ts` — nome com trim 1..120, lat/lon números finitos nas faixas; mensagem "Escolha a cidade na lista".
  - `criarObra(c, dados: { nome; cliente?; endereco?; cidade?: Cidade })` grava `local_nome/latitude/longitude`.
  - `editarCidadeObra(c: SupabaseClient, obraId: string, cidade: Cidade): Promise<Resultado>`.
  - Ações: `buscarCidadesAcao(termo: string): Promise<Cidade[]>`, `salvarCidadeObraAcao(obraId: string, cidade: Cidade): Promise<Resultado>`.
  - `EscolherCidade({ inicial?: Cidade | null; onEscolher?: (c: Cidade) => void; nomeCampo?: string })` (client): campo "Cidade (para o clima)", busca após 2 caracteres com espera de 400 ms, lista de botões (min-h-12), "Nenhuma cidade encontrada", e quando `nomeCampo` é dado renderiza hidden inputs `${nomeCampo}_nome`, `_lat`, `_lon`.
  - `novaObra` lê `cidade_nome/cidade_lat/cidade_lon`; inválida ⇒ `campos.cidade = "Escolha a cidade na lista"`.
  - `CidadeObra({ obraId, inicial })` no padrão de `WhatsappObra.tsx` (Cartao, título "Cidade da obra", subtítulo "Usada para registrar o clima de cada turno no RDO.", "Cidade salva ✓").

- [ ] **Step 1: Write the failing tests**: `validarCidade` aceita `{nome:"Macaé, Rio de Janeiro", latitude:-22.37, longitude:-41.79}`, recusa nome vazio, lat 91, lon `NaN`; integração: `criarObra` com cidade grava as 3 colunas; `editarCidadeObra` atualiza; obra de outra empresa ⇒ "Obra não encontrada".
- [ ] **Step 2: Run** `npx vitest run tests/dominio/cidade.test.ts tests/integracao/obras.test.ts` → FAIL.
- [ ] **Step 3: Implement** o acima; `CidadeObra` entra na página da obra junto de `WhatsappObra`.
- [ ] **Step 4: Run** → PASS; `npx tsc --noEmit`; `npx eslint app/(app)/obras components/obra`.
- [ ] **Step 5: Commit** `feat(obra): cidade obrigatória para o clima automático`.

### Task 5: Bloco de clima nas telas e no RDO; remoção do clima manual

**Files:**
- Create: `components/execucao/ClimaTurno.tsx`, `supabase/migrations/20261202010000_remover_clima_manual.sql`, `app/(app)/obras/[obraId]/turnos/[turnoId]/BuscarClima.tsx`
- Modify: `lib/rdo/secoes.tsx` (`EfetivoEClima`), `lib/dominio/resumo.ts`, `app/(app)/obras/[obraId]/turnos/[turnoId]/{Resumo.tsx,EdicaoExecucao.tsx,page.tsx,acoesExecucao.ts}`, `app/t/[token]/{page.tsx,FormularioCampo.tsx,acoes.ts}`
- Delete: `components/execucao/BlocoClima.tsx`; funções/tipos do clima manual em `lib/db/campo.ts`, `lib/db/execucao.ts`, `lib/db/validacao.ts`, `lib/db/turnos.ts` (`Clima`, campo `clima`), `lib/dominio/tipos.ts` (`CondicaoClima`, `PeriodoClima`, `PERIODOS_CLIMA`, `CONDICOES`), `lib/dominio/assinatura.ts` (`tuplaClima`), `lib/dominio/ultimaAlteracao.ts` (`ultimaAlteracaoClima`), `lib/rdo/versao.ts` (`clima` em `FotoV1`)
- Test: `tests/dominio/clima-ui.test.tsx`, `tests/dominio/rdo.test.tsx`, `tests/dominio/resumo.test.ts`; ajustar os testes que usam o clima manual (achar com `npx tsc --noEmit` e `rg "PERIODOS_CLIMA|CONDICOES|tuplaClima|ultimaAlteracaoClima|salvarClima|climaImpediu|impediu" tests`)

**Interfaces:**
- Consumes: `ClimaTurno`, `rotuloTempo`, `obterClimaTurno`, `gravarClimaTurno`, `TurnoCompleto.clima_turno`.
- Produces:
  - `ResumoTurno.paradasClima: number` (atividades do turno com `causa === "clima"`, qualquer tipo/status) substitui `climaImpediu`.
  - `ClimaTurno` (componente, sem `"use client"`): props `{ clima: ClimaTurno | null; paradasClima: number; aviso?: "sem_cidade" | "indisponivel" | null; linkObra?: string; parcial?: boolean }`. Mostra média em texto grande (`text-4xl`) com "média do turno", "Choveu · 4 mm" / "Não choveu", "máx 33° · mín 24°", grade das leituras (`07h`, rótulo, `27°`, `0 mm`) em `text-sm`, "Atividades paradas por clima: N" quando N > 0, "Dados: Open-Meteo". `parcial` ⇒ título "Clima até agora". Avisos: `sem_cidade` ⇒ "Clima automático indisponível — informe a cidade da obra" (+ link "Informar cidade" se `linkObra`); `indisponivel` ⇒ "Clima indisponível agora".
  - Página do turno e página do campo: com `turno.clima_turno` usam o gravado; senão, se status `em_campo`, `obterClimaTurno(..., { revalidar: 1800 })` com `parcial`; obra sem coordenadas ⇒ `sem_cidade`.
  - `buscarClimaDeNovo(turnoId: string): Promise<Resultado>` em `acoesExecucao.ts` — só com status `enviado`; chama `gravarClimaTurno`; sem resultado ⇒ falha "Não foi possível buscar o clima agora. Tente mais tarde." `BuscarClima` (client) mostra o botão "Buscar clima de novo" quando enviado sem `clima_turno`; fechado sem `clima_turno` mostra "Clima não registrado — reabra e feche o turno para buscar de novo."
  - RDO (`EfetivoEClima`): seção "Clima" com a mesma informação em `@react-pdf` (sem emoji); sem `clima_turno` ⇒ "Clima não disponível no momento do fechamento" ou, se a obra da foto não tem `local_nome`, "Clima não registrado (obra sem cidade)".
  - Migração `20261202010000_remover_clima_manual.sql`: `drop table public.clima` (o ramo `'clima'` de `tg_responsavel_mesma_obra` fica inofensivo; removê-lo redefinindo a função).

- [ ] **Step 1: Write the failing tests**:
  - `clima-ui.test.tsx` (padrão de `resumo-ui.test.tsx`): com o `ClimaTurno` da série de Task 1 mostra "12°", "Choveu · 4 mm", "07h", "Chuva fraca", "Dados: Open-Meteo"; `paradasClima 2` ⇒ "Atividades paradas por clima: 2"; `0` ⇒ sem a linha; `clima null, aviso "sem_cidade", linkObra "/obras/x"` ⇒ link "Informar cidade" para `/obras/x`.
  - `rdo.test.tsx`: RDO de turno com `clima_turno` contém "Choveu" e "13h"; sem `clima_turno` contém "Clima não disponível"; não contém "Manhã".
  - `resumo.test.ts`: 2 atividades com causa clima (uma parcial, uma extra não iniciada) ⇒ `paradasClima 2`.
- [ ] **Step 2: Run** `npx vitest run tests/dominio/clima-ui.test.tsx tests/dominio/rdo.test.tsx tests/dominio/resumo.test.ts` → FAIL.
- [ ] **Step 3: Implement** componente, RDO, resumo, páginas, botão; apagar o clima manual; aplicar a migração (`npx supabase db push`).
- [ ] **Step 4: Run** `npx tsc --noEmit`, `npx eslint`, `npx vitest run` com `SUPABASE_TEST=1` → tudo PASS; `npm run test:e2e` com `FRENTIA_CLIMA_FALSO: "1"` acrescentado ao `env` do `webServer` em `playwright.config.ts` → PASS (ajustar `ciclo-turno.spec.ts` e `campo-permissoes.spec.ts`, que hoje lançam clima: passam a conferir "Clima até agora" no campo e "Choveu" no turno fechado; a obra do e2e ganha cidade "Macaé").
- [ ] **Step 5: Commit** `feat(clima): bloco automático no campo, no turno e no RDO; sai o clima manual`.

### Task 6: Manual, Novidades, backlog e publicação

**Files:**
- Modify: `lib/ajuda/conteudo/campo.ts`, `lib/ajuda/conteudo/fechar-turno.ts`, `lib/ajuda/conteudo/primeiros-passos.ts` (cadastro da obra com cidade), `lib/ajuda/novidades.ts`, `docs/backlog.md`; conferir `lib/ajuda/fluxograma.ts` (só muda se citar lançar clima)
- Test: capturas do manual

- [ ] **Step 1:** Textos: campo deixa de pedir clima e explica "Clima até agora"; fechar turno explica o bloco do RDO, "Buscar clima de novo" e que parada por chuva se marca na atividade com causa **Clima (externa)**; primeiros passos pede a cidade. Novidades no topo: `{ data: "2026-11-25", texto: "Clima automático: o RDO registra sozinho o tempo durante o turno (leitura de 2 em 2 horas, média, máxima, mínima e chuva), pela cidade da obra. Ninguém precisa mais lançar o clima.", href: "/ajuda/fechar-turno#clima" }` (âncora criada no capítulo). Backlog: item "Contratar plano comercial do Open-Meteo quando houver clientes pagantes (trocar `OPEN_METEO_URL` e chave na Vercel)".
- [ ] **Step 2: Run** `$env:SUPABASE_TEST='1'; $env:FRENTIA_CLIMA_FALSO='1'; npm run manual:capturas` (ou `MANUAL_CAPITULO=campo` / `fechar-turno` / `primeiros-passos`) → passa; conferir as imagens novas.
- [ ] **Step 3: Run** `npx vitest run` com `SUPABASE_TEST=1` → PASS (inclui testes do manual).
- [ ] **Step 4: Commit** `docs(manual): clima automático`.
- [ ] **Step 5:** Aplicar as duas migrações no Supabase de produção (mesmo fluxo dos itens anteriores), merge na `main`, push, conferir o deploy na Vercel (se "throttled": `npx vercel redeploy <url> --target production`); cadastrar a cidade das obras existentes de teste; atualizar a memória do roadmap.
