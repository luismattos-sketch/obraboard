# Programação semanal + efetivo previsto — design

Data: 2026-11-11. Bloco 2 revisado do roadmap LPS (ver memória `frentia-roadmap-lps`).

## Objetivo

O planejador programa na reunião semanal o que a equipe se compromete a entregar na semana
(atividades com meta, dias e equipe prevista). Ao longo da semana os turnos executam essa
programação; no encerramento o planejador confirma as causas do que não foi cumprido. Resultado:
**PPC semanal de verdade** (medido contra um compromisso feito antes) e **efetivo previsto × real**
por dia e função, com HH. Base para o quadro de check-in/check-out (próximo bloco) e para pleitos.

## Decisões

| Tema | Decisão |
|---|---|
| Foco | Compromisso semanal + PPC semanal; efetivo previsto dentro do compromisso |
| Compromisso | Meta da semana + dias marcados; sugestão diária automática |
| Efetivo previsto | Por atividade programada; comparado por dia/período/função com o efetivo real do turno |
| Trava | Rascunho → "Programar semana" (trava + foto oficial); reabrir só com motivo novo |
| Vocabulário | Botão "Programar semana"; status "Programada"; atividade nova = "Fora da programação (extra)" |
| Ligação com turnos | Turno criado como hoje; ao criar, traz as atividades programadas do dia/período |
| Encerramento | Manual ("Encerrar semana"); causa das não cumpridas confirmada pelo planejador |
| Análise | Usa a programação quando existe; semanas sem programação mantêm o cálculo atual, marcadas |
| Arquitetura | Tabelas próprias + coluna de ligação em `atividades` + versões oficiais por gatilho |

Fora do escopo: quadro de check-in/check-out, PDF da programação, copiar semana anterior,
lookahead/restrições, efetivo por atividade no campo, mudança no link do encarregado.

## 1. Telas e fluxo

**Página da obra:** novo botão "Programação" (secundário) ao lado de "RDOs" e "Análise (PPC)".

**`/obras/[obraId]/programacao`** — lista de semanas da obra, mais recente primeiro:
- Cada linha: segunda-feira (`dd/mm`), selo de status e PPC (`70% — 7 de 10`, "provisório" se não
  encerrada; "—" em rascunho).
- Selos: Rascunho / Programada / Aguardando encerramento / Encerrada. "Aguardando encerramento" é
  derivado (status `programada` e hoje > domingo da semana), não existe no banco.
- Botão "Programar próxima semana" cria o rascunho da semana seguinte à atual (fuso SP); um seletor
  de data permite criar o rascunho de outra semana (data escolhida é convertida para a segunda-feira).
  Se a semana já existe, abre a existente.

**`/obras/[obraId]/programacao/[inicio]`** (`inicio` = `YYYY-MM-DD` da segunda-feira):
- **Rascunho:** lista editável de atividades. Campos: descrição (obrigatória), local, unidade,
  meta da semana (> 0), dias (chips Seg…Dom, ao menos 1), período (Diurno padrão / Noturno),
  equipe prevista (linhas função + quantidade, sugestões iguais às do efetivo do turno).
  Prévia da sugestão diária (meta ÷ dias). Botão "Programar semana".
- **Programada:** por atividade: meta, realizado, saldo, situação (Cumprida / Em andamento /
  Sem execução). Bloco "Fora da programação (extra)" com as atividades de turnos da semana sem
  ligação. Quadro "Efetivo previsto × real" por dia/período/função (previsto, real, diferença, HH).
  Ações: "Reabrir programação" (motivo) e, a partir do último dia com atividade programada,
  "Encerrar semana".
- **Encerrar semana:** formulário com as atividades programadas não cumpridas, cada uma com a causa
  pré-preenchida (ver regras) e editável. Confirmar encerra.
- **Encerrada:** somente leitura a partir da última foto oficial; ação "Reabrir" (motivo).

**Turno (`/obras/[obraId]/turnos/[turnoId]`):**
- Ao criar um turno, o app insere as atividades programadas para aquele dia e período, somente se
  a semana estiver `programada` (rascunho e encerrada não trazem nada), com a qtd sugerida.
  Selo "Programada" nelas.
- Botão "Trazer da programação" (mesmo comportamento, idempotente) quando o turno é de semana
  programada e há atividades programadas do dia/período ainda não trazidas e com saldo.
- Atividade adicionada à mão em turno de semana programada mostra selo "Extra".
- "Trazer pendentes" ignora atividades com ligação à programação (o saldo já as cobre).
- Link do encarregado (`/t/[token]`) não muda.

## 2. Regras de cálculo

- **Semana:** segunda a domingo, fuso America/Sao_Paulo; identificada pela data da segunda.
  Dias da programação: 0 = segunda … 6 = domingo.
- **Realizado de uma atividade programada:** Σ `qtd_realizada` (nulo = 0) das atividades de turno
  ligadas a ela, em turnos com status `enviado` ou `fechado`.
- **Saldo:** `max(meta − realizado, 0)`.
- **Sugestão do dia** (ao trazer para o turno da data D): se D não é dia marcado ou saldo = 0 →
  não traz. Se D é o último dia marcado → saldo. Senão → `min(arred2(meta ÷ nº de dias), saldo)`.
  O realizado considerado é o dos turnos já existentes da semana (qualquer status com
  `qtd_realizada` preenchida, para que a sugestão acompanhe o campo mesmo antes do envio).
  No turno a qtd é editável sem perder a ligação.
- **Situação:** Cumprida se realizado ≥ meta; Em andamento se 0 < realizado < meta;
  Sem execução se realizado = 0.
- **PPC semanal:** cumpridas ÷ programadas (contagem de atividades). Extras fora do PPC; contadas
  à parte ("+N fora da programação"). Semana sem atividades programadas não pode ser programada.
- **Encerrar:** bloqueado se algum turno da obra com data na semana não estiver `fechado`.
  Toda atividade programada não cumprida exige causa. Causa sugerida: a `causa` não nula da
  atividade de turno ligada mais recente (ordem: data desc, noturno antes de diurno na mesma data,
  isto é, noturno é posterior); sem nenhuma → vazia.
- **Efetivo previsto × real** (por data marcada D e período P):
  - Previsto: Σ quantidades da equipe das atividades programadas com D marcado e período P,
    agrupadas por função normalizada.
  - Real: efetivo do turno (D, P), agrupado por função normalizada.
  - Normalização: trim, minúsculas, sem acentos, espaços internos colapsados. Rótulo exibido = o
    primeiro texto original encontrado (previsto antes do real).
  - Função só de um lado aparece com 0 do outro lado.
  - Sem turno (D, P): linha marcada "sem turno"; real e HH real em branco (não é zero).
  - HH: pessoas × horas do turno (mesma regra existente: horário real se ambos preenchidos, senão
    previsto). HH previsto usa as mesmas horas; sem horário → HH em branco.
- **Reabrir:** programada → rascunho; encerrada → programada. Motivo 3–500 caracteres, diferente do
  motivo anterior (trim). Ligações com atividades de turno são mantidas.
- **Apagar atividade programada** com alguma atividade de turno ligada: bloqueado.
- **Semana encerrada:** números (PPC, situação, causas, previsto × real) lidos da última foto
  oficial, não recalculados ao vivo.

## 3. Banco (migration `20261111000000_programacao_semanal.sql`)

```
semanas
  id uuid pk, obra_id uuid fk obras on delete cascade, inicio date not null
    check (extract(isodow from inicio) = 1),
  status text not null default 'rascunho' check in ('rascunho','programada','encerrada'),
  programada_em timestamptz, encerrada_em timestamptz, motivo_reabertura text,
  created_at, updated_at, unique (obra_id, inicio)

programacao_atividades
  id uuid pk, semana_id uuid fk semanas on delete cascade, ordem int default 0,
  descricao text not null, local text, unidade text, meta numeric not null check (meta > 0),
  dias smallint[] not null (não vazio, valores 0–6, sem repetição — check via função imutável),
  periodo text not null default 'diurno' check in ('diurno','noturno'),
  causa text null (mesma lista de causas de atividades), created_at, updated_at

programacao_efetivo
  id uuid pk, programacao_atividade_id uuid fk on delete cascade, funcao text not null,
  quantidade int not null check (> 0), created_at, updated_at

atividades + programacao_atividade_id uuid null fk programacao_atividades on delete restrict
  unique index parcial (turno_id, programacao_atividade_id) where programacao_atividade_id is not null

semana_versoes
  id uuid pk, semana_id fk on delete cascade, obra_id fk, numero int > 0,
  evento text check in ('programada','encerrada'), emitido_em timestamptz, formato int default 1,
  dados jsonb not null, created_at, unique (semana_id, numero)
```

Índices em todas as FKs. Triggers `updated_at` como nas demais tabelas.

**Gatilhos / invariantes** (erros com `errcode P0001` e mensagem-código):
1. `programacao_atividades` / `programacao_efetivo`: insert/update/delete só com semana em
   `rascunho` → senão `semana_travada`. Exceção: update apenas da coluna `causa` com semana
   `programada` (usado no encerramento). `causa` não pode ser gravada em rascunho.
2. `semanas` rascunho → programada: exige ≥ 1 atividade (`programacao_vazia`); grava
   `programada_em = now()`.
3. programada → encerrada: exige todos os turnos da obra com data em [inicio, inicio+6] fechados
   (`turno_aberto`) e causa em toda atividade não cumprida (`causa_pendente`; o cálculo de cumprida
   no banco usa a mesma regra de realizado); grava `encerrada_em = now()`.
4. Reaberturas (programada → rascunho, encerrada → programada): motivo obrigatório e novo
   (`motivo_obrigatorio`, `motivo_repetido`), mesma lógica de `tg_exigir_motivo_reabertura`.
   Outras transições (rascunho → encerrada, encerrada → rascunho) → `transicao_invalida`.
5. `atividades.programacao_atividade_id` não nulo: turno da mesma obra da semana, data dentro da
   semana e período igual ao da atividade programada → senão `programacao_incompativel`.
6. Apagar `programacao_atividades` com atividades ligadas → `atividade_com_execucao`
   (via FK `on delete restrict` traduzida, ou gatilho explícito).
7. `semana_versoes`: gatilho `after update of status` emite versão (security definer) quando entra
   em `programada` ou `encerrada`, com `foto_semana(semana_id)`: semana, atividades com equipe,
   realizado, situação, causa, extras, PPC e previsto × real calculados no momento.

**RLS:** `semanas`, `programacao_atividades`, `programacao_efetivo` com policy "all" para
membros da empresa da obra (`eh_membro`), no padrão das tabelas existentes. `semana_versoes`
somente select para membros; sem insert/update/delete pelo app.

Aplicação: SQL Editor do Supabase, DEV primeiro, depois PROD (sem psql nesta máquina).

## 4. Código

- `lib/dominio/programacao.ts` (puro): `inicioDaSemanaDe`, `sugestaoDoDia`,
  `situacaoAtividade`, `ppcSemanal`, `causaSugerida`, `efetivoPrevistoReal`, `normalizarFuncao`,
  `statusExibido` (inclui "aguardando encerramento").
- `lib/db/programacao.ts`: listar semanas, obter semana completa, criar rascunho (idempotente),
  salvar/apagar atividade e equipe, programar, encerrar (grava causas e muda status numa função
  SQL `encerrar_semana(p_semana_id, p_causas jsonb)` para ser atômico), reabrir, trazer da
  programação para um turno, ler última versão.
- `lib/db/turnos.ts` `criarTurno`: após criar, chama "trazer da programação"; falha nessa etapa não
  desfaz o turno (botão manual resolve).
- `lib/db/atividades.ts`: "trazer pendentes" ignora atividades com `programacao_atividade_id`;
  tipo de atividade ganha o campo.
- `lib/dominio/analise.ts`: `analisarObra` recebe também as semanas programadas/encerradas; semana
  com programação usa `ppcSemanal` (ao vivo ou da foto); demais semanas mantêm o cálculo atual com
  marca `semProgramacao: true`. Ranking de causas: semanas com programação contribuem com as causas
  confirmadas (encerradas) ou sugeridas (provisórias); demais como hoje.
- `lib/db/mensagens.ts`: novos códigos `semana_travada`, `turno_aberto`, `programacao_vazia`,
  `atividade_com_execucao`, `programacao_incompativel`, `transicao_invalida`; reaproveita
  `causa_pendente`, `motivo_obrigatorio`, `motivo_repetido`.
- Telas em `app/(app)/obras/[obraId]/programacao/` (lista e `[inicio]`), componentes existentes
  (Cartao, Selo, Botao, Barra, Expansivel).

## 5. Erros (mensagens)

- `semana_travada`: "A semana já foi programada. Reabra para editar."
- `turno_aberto`: "Feche os turnos da semana antes de encerrar: <lista dd/mm período>."
- `causa_pendente`: "Informe a causa das atividades não cumpridas."
- `programacao_vazia`: "Inclua ao menos uma atividade para programar."
- `atividade_com_execucao`: "Esta atividade já tem execução em turnos e não pode ser apagada."
- `programacao_incompativel`: "Esta atividade programada não vale para este turno."
- `transicao_invalida`: "Ação não permitida para o status atual da semana."
- `motivo_obrigatorio` / `motivo_repetido`: mensagens existentes.

## 6. Testes

- **Vitest (domínio):** sugestão diária (divisão, arredondamento, último dia = saldo, saldo zero,
  dia não marcado); situação; PPC por contagem sem extras; causa sugerida (ordem diurno/noturno,
  nenhuma → vazia); normalização de função; previsto × real (função só de um lado, sem turno ≠ 0,
  HH com e sem horário); status exibido; análise com semana programada, encerrada (foto) e sem
  programação.
- **Integração (`SUPABASE_TEST=1`):** cada gatilho (trava, causa fora de hora, programar vazio,
  encerrar com turno aberto e sem causa, reabrir sem motivo e com motivo repetido, transição
  inválida, apagar com execução, ligação com turno fora da semana/período/obra); versões emitidas
  ao programar e encerrar; trazer da programação idempotente; criar turno traz atividades; RLS
  (outra empresa não vê).
- **E2E (Playwright):** montar semana → programar → criar turno de terça (atividade vem com
  sugestão) → lançar realizado → fechar turnos → encerrar com causa → PPC na semana e na análise.
