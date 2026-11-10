# Frentia — Histórico de RDO, etapa H1: versões oficiais + telas de RDOs (design)

Data: 2026-11-10 · Branch: `historico-rdo` · Etapa H1 de 4 do histórico de RDO.

## Objetivo

Tornar o RDO um **registro oficial que não muda**: cada fechamento de turno emite uma versão
numerada e imutável do RDO. Um RDO fechado e baixado hoje tem o mesmo conteúdo daqui a um ano,
mesmo que o turno seja reaberto e corrigido (a correção gera uma nova versão; a anterior continua
disponível). Além disso, o planejador encontra e baixa RDOs antigos por obra e numa tela geral.

Público: planejador (usuário autenticado da empresa). O encarregado continua sem acesso a RDO.

## Contexto (estado atual)

- O PDF é gerado sob demanda a partir dos dados atuais do turno (`app/api/rdo/[turnoId]/route.ts`,
  `lib/rdo/documento.tsx`); cabeçalho mostra "Gerado em…". Nada é guardado.
- Fechar/reabrir é um `update` simples de `turnos.status` (`aplicarAcao` em `lib/db/turnos.ts`),
  com travas no banco (`tg_turno_causa_pendente`, `tg_turno_fechado_imutavel`,
  `tg_bloquear_turno_fechado`).
- O app só apaga turnos com status `planejado`; obras não são apagadas.

## Divisão do histórico (contexto)

| Etapa | Conteúdo |
|---|---|
| **H1 (esta spec)** | Versões oficiais guardadas + tela "RDOs" por obra + tela geral |
| H2 | Linha do tempo do turno (eventos criou/enviou/fechou/reabriu) |
| H3 | Baixar vários RDOs de um período (PDF único ou ZIP) |
| H4 | Consolidado do período (relatório mensal) |

## Decisões

| Tema | Decisão |
|---|---|
| Quando nasce uma versão | Automaticamente a cada transição de status para `fechado`. Reabrir e fechar de novo gera v2, v3… |
| O que é guardado | Uma "foto" (JSON) dos dados de entrada do RDO, gravada no banco na mesma transação do fechamento. O PDF é renderizado a partir da foto a cada download. |
| Resumo (% cumprimento, contagens) | Não é guardado; é calculado a partir da foto com `resumirTurno` na hora de gerar o PDF/lista. |
| Identificação no PDF | "Versão N · substitui a versão N-1, emitida em …" + "Emitido em …". |
| Turnos já fechados antes da H1 | A migration cria a v1 retroativa (`retroativa = true`, `emitido_em = fechado_em`); o PDF mostra "(versão registrada retroativamente)". |
| Turno aberto | Download entrega prévia com marca-d'água "RASCUNHO"; se já houver versão oficial, a tela oferece também a última oficial. |
| Telas | `/obras/[obraId]/rdos` (filtro por mês) e `/rdos` (filtro por obra e mês), mesmo componente de lista. |
| Armazenamento de PDF | Não há (sem Supabase Storage). Pode ser somado no futuro sem quebrar este desenho. |

Limite aceito: a **aparência** do PDF e a **regra de cálculo do resumo** acompanham o código atual;
o **conteúdo** (dados de entrada e data de emissão) fica congelado.

## Fora do escopo

Seleção múltipla/baixar em lote (H3), consolidado do período (H4), linha do tempo/auditoria (H2),
PDF guardado byte a byte, acesso do encarregado ou do cliente a RDOs, assinatura digital.

## 1. Banco de dados (migration nova)

### Tabela `public.rdo_versoes`

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `turno_id` | uuid not null | FK `turnos(id)` on delete cascade |
| `obra_id` | uuid not null | FK `obras(id)` on delete cascade (denormalizado para filtros) |
| `numero` | integer not null | `> 0`; `unique (turno_id, numero)` |
| `emitido_em` | timestamptz not null | instante do fechamento |
| `retroativa` | boolean not null default false | true só nas v1 criadas pela migration |
| `formato` | integer not null default 1 | versão do formato do JSON `dados` |
| `dados` | jsonb not null | a foto (ver abaixo) |
| `created_at` | timestamptz not null default now() | |

Índices: `(obra_id, emitido_em desc)` e o único `(turno_id, numero)`.

FKs em cascata (decisão da fase de plano): a remoção de uma empresa inteira (rollback do cadastro,
limpeza dos testes) precisa continuar funcionando. O app não consegue apagar turno com versão,
porque `removerTurno` só apaga turnos `planejado` e um turno que já fechou nunca volta a
`planejado` (reabrir leva a `enviado`).

### Formato da foto (`formato = 1`)

```json
{
  "obra":   { "id", "empresa_id", "nome", "cliente", "endereco" },
  "turno":  { "id", "obra_id", "data", "periodo",
              "hora_inicio_prevista", "hora_fim_prevista",
              "hora_inicio_real", "hora_fim_real", "enviado_em", "fechado_em" },
  "atividades": [ { "id", "ordem", "descricao", "local", "unidade",
                    "qtd_planejada", "qtd_realizada", "causa", "observacao", "origem_id" } ],
  "efetivo": [ { "id", "funcao", "quantidade" } ],
  "clima":   [ { "periodo", "condicao", "impediu" } ]
}
```

Atividades ordenadas por `ordem`. Não inclui `token_hash`.

### Gatilho de emissão

- Função `public.tg_emitir_rdo_versao()` (`security definer`, `search_path = ''`), gatilho
  `after update of status on public.turnos for each row when (old.status is distinct from 'fechado'
  and new.status = 'fechado')`.
- Monta a foto com `jsonb_build_object` a partir das tabelas `obras`, `atividades`, `efetivo`,
  `clima` e da linha `new`; `numero = coalesce(max(numero), 0) + 1` do turno;
  `emitido_em = coalesce(new.fechado_em, now())`.
- Por ser `after` e na mesma transação, roda só depois de todas as travas `before` passarem;
  qualquer erro desfaz o fechamento.
- `fechado_em` já é preenchido no mesmo `update` por `aplicarAcao` (e zerado ao reabrir), então
  `emitido_em = new.fechado_em`; o `coalesce(…, now())` é só defesa.
- Concorrência: `aplicarAcao` já grava com `eq("status", statusLido)`, então o segundo fechamento
  simultâneo não atualiza linha alguma (mensagem de concorrência existente). A unicidade
  `(turno_id, numero)` é a defesa final no banco.

### Acesso (RLS)

- `enable row level security`; política de **select** para `authenticated` quando
  `eh_membro(empresa da obra)` (mesmo padrão das demais tabelas).
- Sem políticas de insert/update/delete: o app não altera nem apaga versões. Inserção só via gatilho
  (`security definer`). `revoke insert, update, delete` de `anon` e `authenticated`.

### Retroativas

A migration insere, para cada turno com `status = 'fechado'` sem versão, a v1 com
`retroativa = true`, `emitido_em = coalesce(fechado_em, updated_at)` e a foto montada pela mesma
função auxiliar SQL usada pelo gatilho (`public.foto_rdo(turno_id) returns jsonb`).

## 2. Domínio e PDF

- `lib/rdo/versao.ts` (puro):
  - `lerFoto(versao) → TurnoCompleto` (status `fechado`); `formato` desconhecido → lança erro.
  - `cabecalhoVersao({ numero, emitidoEm, retroativa, anterior? })` e `cabecalhoRascunho(geradoEm)`
    → linhas de texto do cabeçalho.
- `lib/db/rdo-versoes.ts`: `listarVersoes(c, { obraId?, mes? })`, `obterVersao(c, id)`,
  `versoesDoTurno(c, turnoId)`.
- `DocumentoRdo` recebe uma prop `emissao`:
  `{ tipo: "oficial", numero, emitidoEm, retroativa, anterior?: { numero, emitidoEm } }` ou
  `{ tipo: "rascunho", geradoEm }`. O layout atual é mantido.
  - Oficial: "RDO · Versão 2 · substitui a versão 1, emitida em 09/11/2026 18:40 · Emitido em
    10/11/2026 08:15 (horário de Brasília)". v1: sem o trecho "substitui". Retroativa: acrescenta
    "(versão registrada retroativamente)".
  - Rascunho: marca-d'água diagonal "RASCUNHO" em todas as páginas + linha "Rascunho — não é o RDO
    oficial · Gerado em …".
- `nomeArquivoRdo` ganha sufixo: `RDO-<obra>-<AAAA-MM-DD>-<periodo>-v2.pdf` ou `…-rascunho.pdf`.
  Na versão oficial o nome da obra vem da foto.

## 3. Rotas de download

- **Nova** `GET /api/rdo/versao/[versaoId]`: PDF da versão oficial (foto + `emissao` oficial, com a
  versão anterior quando `numero > 1`).
- **Existente** `GET /api/rdo/[turnoId]`:
  - turno `fechado` → PDF da versão mais recente (igual à rota nova);
  - turno aberto → prévia com `emissao: rascunho`, a partir dos dados atuais.
- Ambas: `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `Cache-Control: no-store`; sem login →
  `/login?proximo=…`; inexistente/outra empresa → 404.

## 4. Telas

### Tela do turno (`/obras/[obraId]/turnos/[turnoId]`)

- Fechado: "Baixar RDO (v2)" e, abaixo, "Versões anteriores: v1 (09/11 18:40)" com link de cada.
- Aberto sem versão: "Baixar prévia (rascunho)".
- Reaberto (aberto com versão): "Baixar prévia (rascunho)" + "Baixar v1 oficial".

### `/obras/[obraId]/rdos`

- Acesso: botão "RDOs" na página da obra, ao lado de "Análise (PPC)".
- Filtro por mês via query `?mes=AAAA-MM` (ausente/inválido → "Todos"); opções = meses com RDO
  (pela data do turno). Nada em localStorage/sessionStorage.
- Uma linha por turno com versão, mais recente primeiro (data do turno, depois período): data,
  período, % de cumprimento da versão atual, selo "vN", selo "Turno reaberto" se o turno não está
  `fechado`, botão "Baixar" (versão atual).
- Turno com mais de uma versão: `Expansivel` com as anteriores ("v1 · emitida 09/11 18:40 · Baixar").
- Vazio: "Nenhum RDO emitido ainda. O RDO é registrado quando você fecha um turno."

### `/rdos`

- Acesso: item "RDOs" no menu lateral (`components/navegacao/MenuLateral.tsx`), abaixo de "Obras".
- Mesma lista, com coluna/linha do nome da obra (da foto) e filtros `?obra=<id>&mes=AAAA-MM`.

### Componente

`ListaRdos` compartilhado (prop `mostrarObra`). Agrupamento por turno e opções de mês em função pura
testável (`agruparVersoes`, `mesesDisponiveis`).

## 5. Erros

| Situação | Comportamento |
|---|---|
| Fechar recusado pelas travas atuais | Nada muda; mesma mensagem de hoje; nenhuma versão criada. |
| Fechamento simultâneo | Unicidade falha; mensagem de concorrência existente. |
| Versão inexistente/outra empresa | 404. |
| Sem login | Redireciona ao login e volta ao download. |
| `formato` desconhecido | `console.error` + resposta 500 "Não foi possível gerar o RDO". Nunca PDF errado. |
| Turno reaberto e editado | Versões existentes não mudam. |

## 6. Testes

- **Unitários (vitest)**: `lerFoto` (inclusive formato desconhecido); textos de cabeçalho (v1, v2
  com anterior, retroativa, rascunho); `nomeArquivoRdo` com `-v2`/`-rascunho`; `agruparVersoes` e
  `mesesDisponiveis`; renderização do `DocumentoRdo` com `emissao` (estende `tests/dominio/rdo.test.tsx`).
- **Integração (`SUPABASE_TEST=1`)**: fechar cria v1 com foto correta; reabrir → editar → fechar
  cria v2 e a v1 permanece idêntica; `authenticated` não consegue update/delete em `rdo_versoes`;
  outra empresa não lê versões; `removerTurno` recusa turno reaberto que tem versão; função
  `foto_rdo` usada nas retroativas.
- **E2E (Playwright)**: fechar turno → "RDOs" da obra → v1 listada e baixável; reabrir e fechar →
  v2 com v1 no expansível; tela geral `/rdos` lista o RDO.

## 7. Entrega

Branch `historico-rdo` a partir da `main` → prévia no Vercel → validação do usuário → merge
`--no-ff` na `main` + push. A migration é aplicada no Supabase de produção no merge (com a criação
das retroativas).
