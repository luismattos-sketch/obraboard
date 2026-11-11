# Frentia — Histórico de RDO, etapa H2: linha do tempo do turno (design)

Data: 2026-11-10 · Branch: `historico-rdo-h2` · Etapa H2 de 4 do histórico de RDO (H1 no ar: versões
oficiais em `rdo_versoes`).

## Objetivo

Auditar o ciclo de cada turno: registrar os marcos (criado, link liberado, novo link, enviado, fechado
com RDO vN, reaberto) com data/hora e quem fez, e exigir um **motivo** ao reabrir. O motivo aparece na
linha do tempo e no PDF da versão oficial seguinte. Responde a "quando o encarregado enviou?" e
"quem reabriu, quando e por quê?".

Público: planejador. O encarregado não vê a linha do tempo.

## Contexto (estado atual)

- Transições (`lib/dominio/regras.ts` `transicaoTurno`): liberar planejado→em_campo; enviar
  em_campo→enviado; fechar em_campo|enviado→fechado; reabrir fechado→enviado.
- `aplicarAcao` (`lib/db/turnos.ts`) grava com o cliente do planejador (RLS, `auth.uid()` presente),
  exceto "enviar", que só o encarregado faz, pelo link, via `criarClienteAdmin()` em
  `lib/db/campo.ts` (`auth.uid()` nulo).
- `gerarNovoLink` troca `token_hash` sem mudar status.
- Nome do usuário: `auth.users.raw_user_meta_data->>'nome'` (gravado no cadastro); o app usa e-mail como
  alternativa.
- Não há histórico hoje; `fechado_em` é zerado ao reabrir.

## Decisões

| Tema | Decisão |
|---|---|
| Escopo | Só marcos do ciclo; alterações de dados (atividades, efetivo, clima) ficam fora. |
| Quem fez | Planejador: nome (ou e-mail) copiado no momento do evento. Encarregado: "Encarregado (link de campo)". |
| Motivo ao reabrir | Obrigatório, 3 a 500 caracteres (após `trim`), validado no app e no banco. |
| Registro | Gatilhos no banco, na mesma transação da ação (tudo ou nada). |
| Onde aparece | Bloco "Histórico (N)" recolhido no fim da tela do turno, em todos os status. |
| PDF | A partir da v2: "· Motivo da correção: …" no destaque. |
| Turnos antigos | Sem histórico inventado; nota "Histórico registrado a partir de 10/11/2026" quando falta o evento `criado`. |

## Fora do escopo

Auditoria de alterações de dados, histórico no PDF, visão do encarregado, filtro/busca de eventos,
eventos de exclusão (turno excluído some com seus eventos).

## 1. Banco de dados (migration nova)

### Coluna `turnos.motivo_reabertura`

`text null`. Gravada pelo app no mesmo `update` da reabertura. Não é limpa ao fechar: a foto do RDO
seguinte a lê.

### Tabela `public.turno_eventos`

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `turno_id` | uuid not null | FK `turnos(id)` on delete cascade |
| `obra_id` | uuid not null | FK `obras(id)` on delete cascade |
| `tipo` | text not null | check in (`criado`,`liberado`,`novo_link`,`enviado`,`fechado`,`reaberto`) |
| `em` | timestamptz not null default now() | |
| `ator_tipo` | text not null | check in (`planejador`,`encarregado`) |
| `ator_nome` | text null | nome/e-mail do planejador no momento; null para encarregado |
| `versao` | integer null | só em `fechado`: número da versão emitida |
| `motivo` | text null | só em `reaberto` |

Índice `(turno_id, em)`. RLS e grants iguais a `rdo_versoes`: select para membros da empresa da obra,
sem insert/update/delete para `anon`/`authenticated`.

### Gatilhos

- **Motivo obrigatório** (`before update of status`): quando `old.status = 'fechado'` e
  `new.status <> 'fechado'`, exige `char_length(btrim(new.motivo_reabertura))` entre 3 e 500, senão
  `raise exception 'motivo_obrigatorio' using errcode = 'P0001'`.
- **Registro de eventos** (`security definer`, `search_path = ''`):
  - `after insert on turnos` → `criado`.
  - `after update on turnos`:
    - planejado→em_campo → `liberado` (mesmo com troca de `token_hash`);
    - status igual, `token_hash` mudou e novo não nulo → `novo_link`;
    - em_campo→enviado → `enviado` (`ator_tipo = 'encarregado'`);
    - →fechado → `fechado` com `versao` = `max(numero)` de `rdo_versoes` do turno;
    - fechado→enviado → `reaberto` com `motivo = btrim(new.motivo_reabertura)`.
  - Ator: em `enviado`, sempre encarregado. Nos demais, planejador com
    `ator_nome = coalesce(nullif(btrim(u.raw_user_meta_data->>'nome'), ''), u.email)` de `auth.users`
    onde `id = auth.uid()` (null se não houver usuário).
  - O nome do gatilho deve ordenar **depois** de `turnos_emitir_rdo` (Postgres dispara gatilhos do
    mesmo evento em ordem alfabética), para a versão já existir: `turnos_registrar_evento`.
- **Foto do RDO**: `foto_rdo` passa a incluir `turno.motivo_reabertura`. O formato continua 1 (campo
  opcional; fotos antigas sem o campo são lidas como `null`).

## 2. App

- `lib/dominio/eventos.ts` (puro):
  - `type EventoTurno = { id; tipo; em: string; atorTipo; atorNome: string | null; versao: number | null; motivo: string | null }`;
  - `validarMotivo(texto: unknown): Resultado<string>` (`trim`; vazio ou < 3 → "Informe o motivo da
    reabertura"; > 500 → "O motivo pode ter até 500 caracteres");
  - `rotuloEvento(e): string`: "Turno criado", "Link liberado para o campo", "Novo link gerado (o
    anterior parou de funcionar)", "Enviado pelo campo", "Fechado · RDO vN emitido", "Reaberto";
  - `rotuloAtor(e): string`: nome/e-mail; "Encarregado (link de campo)"; "—" se nulo.
- `lib/db/eventos.ts`: `listarEventos(c, turnoId): Promise<EventoTurno[]>` em ordem `em` crescente.
- `aplicarAcao(c, turnoId, acao, opcoes?: { motivo?: string })`: em "reabrir", valida com
  `validarMotivo` e grava `motivo_reabertura`; erro de banco `motivo_obrigatorio` → mesma mensagem.
  `mensagens.ts` ganha `motivo_obrigatorio` em `ErroBanco`.
- `reabrirTurnoAcao` lê `motivo` do formulário.
- `AcoesTurno`: "Reabrir turno" abre o formulário (textarea `name="motivo"`, `maxLength=500`,
  `required`), aviso "O motivo fica registrado no histórico e no próximo RDO oficial", botões
  "Confirmar reabertura" e "Cancelar".
- `HistoricoTurno` (servidor, tela do turno, fim da página): `Expansivel` com resumo
  "Histórico (N)"; linhas "dd/mm às hh:mm · <rótulo> · <ator>"; em `fechado`, "RDO vN" é link para
  `/api/rdo/versao/<id>` (id da versão pelo número, via `versoesDoTurno` já carregado na página); em
  `reaberto`, motivo abaixo em texto menor. Sem evento `criado` → nota "Histórico registrado a partir
  de 10/11/2026". Erro de leitura → "Não foi possível carregar o histórico".
- PDF: `lerFoto` passa adiante `motivo_reabertura`; `Emissao` oficial ganha `motivo?: string`;
  `emissaoDaVersao` usa o motivo da foto quando `numero > 1`; `linhasEmissao` acrescenta
  " · Motivo da correção: <motivo>" ao destaque (antes de " · Emitido em").

## 3. Erros

| Situação | Comportamento |
|---|---|
| Reabrir sem motivo / curto | "Informe o motivo da reabertura"; nada muda. |
| Motivo > 500 | "O motivo pode ter até 500 caracteres". |
| Reabertura concorrente | Mensagem de concorrência existente; um só evento `reaberto`. |
| Falha ao gravar evento | A ação inteira é desfeita; mensagem genérica atual. |
| Falha ao ler histórico | Aviso no bloco; o resto da página funciona. |

## 4. Testes

- **Unitários**: `validarMotivo` (vazio, "ab", 500 ok, 501, espaços nas pontas); `rotuloEvento` e
  `rotuloAtor` para cada tipo; `linhasEmissao` com motivo; `lerFoto` com e sem `motivo_reabertura`;
  `HistoricoTurno` (linhas, link da versão, motivo, nota de turno antigo).
- **Integração**: ciclo criado → liberado → novo_link → enviado (pelo campo) → fechado(v1) →
  reaberto(motivo) → fechado(v2), na ordem, com atores certos e `ator_nome` do planejador; reabrir sem
  motivo recusado pelo banco (update direto) e pelo app; foto v2 com motivo e v1 sem; app não
  grava/altera/apaga eventos; outra empresa não lê.
- **E2E**: reabrir exige motivo; histórico mostra os eventos; PDF segue baixando.

## 5. Entrega

Branch `historico-rdo-h2` → migration no Supabase dev (usuário, SQL Editor) → prévia → validação →
migration em produção **antes** do merge → merge `--no-ff` na `main` + push.
