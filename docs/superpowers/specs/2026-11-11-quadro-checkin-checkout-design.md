# Quadro de check-in / check-out — design

Data: 2026-11-11. Item 2 do roadmap revisado (ver memória `frentia-roadmap-lps`).

## Objetivo

Conduzir as duas reuniões do turno (check-in no início, check-out no fim) olhando um **quadro organizado
por responsável**, no celular do planejador, numa TV do canteiro ou à distância pelo gestor. O quadro é
**só visualização** do turno que já existe: a edição continua nas telas atuais (planejamento do turno =
check-in; correção da execução/fechamento = check-out). O app guarda uma **foto oficial do check-in**
(o compromisso feito antes da execução); o registro oficial do check-out é a versão do RDO que já existe.

Sucesso: o planejador conduz as duas reuniões sem papel de apoio, cada equipe vê e lança só o que é dela,
e fica registrado o que foi combinado (check-in) e o que aconteceu (RDO).

## Vocabulário (regra do produto)

No app a pessoa que assume atividades se chama sempre **"Responsável"** (pode ser encarregado, líder,
supervisor…). Neste documento "encarregado" aparece só para explicar o personagem de campo. No código:
`responsavel`. Textos existentes trocados:

| Onde | Hoje | Passa a ser |
|---|---|---|
| Tela do turno (`PainelLink.tsx`) | "Link do encarregado" | "Link de campo" |
| Tela do turno (`page.tsx`) | "O encarregado precisa recarregar a página…" | "Quem estiver com o link de campo precisa recarregar a página…" |
| Site (`(publico)/page.tsx`) | "Encarregado lança pelo celular" / "O encarregado registra…" | "A equipe de campo lança pelo celular" / "A equipe de campo registra…" |

## Decisões

| Tema | Decisão |
|---|---|
| Organização do quadro | Faixas horizontais por responsável + faixa "Sem responsável" no fim |
| Origem do responsável | Escolhido na programação semanal; copiado para o turno; ajustável no turno |
| Cadastro | Lista simples de responsáveis por obra (nome, telefone opcional, ativo) |
| Obrigatoriedade | Opcional em tudo; aviso suave no rascunho da programação |
| Link de campo | Um link por turno (como hoje); a pessoa escolhe o próprio nome e vê só a sua equipe |
| RDO | Único por turno, com todas as equipes e **sem nomes de responsáveis** (inalterado) |
| Onde se edita | Nas telas existentes do turno e da programação; o quadro é só leitura |
| Efetivo | Por responsável no turno (efetivo presente por equipe) |
| Foto oficial | Só do check-in, gravada por gatilho ao liberar o turno; check-out = versão do RDO |
| Acesso TV/gestor | Link do quadro por obra, só leitura, sem login, regenerável |
| Visão | Automática pela situação do turno (check-in / check-out), seletor para a outra |
| Turno exibido | "Turno de agora" automático + setas ← → + botão "Agora" |
| Check-out | Barra programado × lançado, causa, resumo da equipe (extras à parte) e HH |
| Atualização | Recarrega os dados a cada ~30 s (sem tempo real) |

Fora do escopo: restrições do dia (item 5 do roadmap), aviso de parada (item 3), usuário próprio para o
gestor (item 6), foto do check-out separada do RDO, análise de PPC por responsável, impressão do quadro,
links individuais por responsável.

## 1. Dados (migration nova)

**`responsaveis`** — `id`, `obra_id` (fk obras, cascade), `nome` (text, não vazio após trim), `telefone`
(text, opcional), `ativo` (bool, padrão true), `created_at`, `updated_at`. Índice único
`(obra_id, lower(btrim(nome)))`. RLS no padrão do projeto (membro da empresa da obra; navegador não lê
tabelas diretamente — acesso pelas funções de `lib/db`).

**Colunas novas (todas opcionais, `on delete set null`):**
- `programacao_atividades.responsavel_id` → responsaveis.
- `atividades.responsavel_id` → responsaveis.
- `efetivo.responsavel_id` → responsaveis.
- `atividades.lancado_por_id` → responsaveis: quem salvou a execução pelo link de campo pela última vez
  (fica nulo quando quem salvou estava em "Ver tudo" ou foi o planejador).

**Invariante:** o responsável de uma atividade/efetivo/atividade programada pertence à **mesma obra**
(gatilho `before insert or update` que recusa com `responsavel_invalido`).

**Cópia da programação:** `trazerDaProgramacao` (e a criação de turno que traz as atividades do dia)
copia `responsavel_id` da atividade programada. Depois disso, mudar no turno não altera a programação e
vice-versa. A foto oficial da semana (`foto_semana`) passa a incluir `responsavel_id` e o nome.

**Efetivo por equipe:** a função `substituir_efetivo` ganha o parâmetro opcional `p_responsavel_id`
e o modo:
- sem escopo (planejador e "Ver tudo"): comportamento atual — substitui todas as linhas do turno;
- com escopo (responsável escolhido no link): substitui **só** as linhas com aquele `responsavel_id`;
  a checagem de conflito (`efetivo_conflito`, compara com o `esperado`) vale só para essas linhas.

Linhas inseridas pelo link com responsável escolhido recebem esse `responsavel_id`.

**`checkin_fotos`** — `id`, `turno_id` (fk, cascade, **único**), `obra_id`, `emitido_em` (timestamptz),
`formato` (int, padrão 1), `dados` (jsonb), `created_at`. Gravada por gatilho `after update of status on
turnos` quando `old.status = 'planejado' and new.status = 'em_campo'` (o turno só passa por isso uma
vez). Se o gatilho falhar, a liberação inteira é desfeita. Leitura pelos membros da empresa; escrita só
pelo gatilho (security definer), como em `rdo_versoes`.

`dados` (formato 1):
```json
{
  "obra": {"nome": "…"}, "turno": {"data": "2026-11-11", "periodo": "diurno",
           "hora_inicio_prevista": "07:00", "hora_fim_prevista": "17:00"},
  "equipes": [
    {"responsavel_id": "…|null", "nome": "João|null",
     "atividades": [{"id": "…", "descricao": "…", "local": "…", "unidade": "un",
                     "qtd_planejada": 4, "programada": true}],
     "efetivo": [{"funcao": "Mecânico", "quantidade": 2}]}
  ]
}
```

**Evento do turno:** o evento `liberado` em `turno_eventos` continua; a linha do tempo exibe-o como
"Check-in registrado" com link para a foto.

**Link do quadro:** `obras.quadro_token_hash` (text, único, nulo = sem link). Mesmo esquema do link de
campo (`lib/dominio/token.ts`): o código aparece só no momento de gerar; o banco guarda o hash. Gerar
novo substitui o hash e o anterior deixa de funcionar.

## 2. Telas do planejador (onde se edita)

**Página da obra:**
- Seção **"Responsáveis"**: lista (nome, telefone, selo "inativo"), adicionar, editar, desativar/reativar.
- Bloco **"Link do quadro (TV / gestor)"**: "Gerar link" (quando não há), e depois "Copiar", "Abrir" e
  "Gerar novo link" (confirmação: "O link atual vai parar de funcionar").

**Menu "Responsável"** (componente único reutilizado): opções = responsáveis ativos da obra, em ordem
alfabética; "Sem responsável"; **"+ Novo responsável…"** (abre campo de nome e cadastra sem sair da tela,
igual ao "Outra função…" do efetivo). Um responsável inativo já atribuído aparece como "Nome (inativo)".

**Programação semanal** (`FormAtividadeProgramada`): campo "Responsável". Grade semanal: nome em letra
pequena na barra. Rascunho: aviso suave "N atividades sem responsável" (não bloqueia "Programar semana").

**Tela do turno (check-in):**
- Atividades **agrupadas por responsável** (cabeçalho com o nome; "Sem responsável" no fim), cada uma
  com o menu "Responsável" para trocar.
- Efetivo agrupado por responsável: em cada equipe, linhas função + quantidade; "+ Adicionar equipe"
  escolhe outro responsável. Sugestões de função: as da programação daquela equipe, depois as da obra.
- Botão de liberar ao campo: mesmo comportamento, com o texto de apoio "Ao liberar, o check-in fica
  registrado."
- Botão **"Ver quadro"** (abre `/obras/[obraId]/quadro?turno=[turnoId]`).

**Correção da execução / fechamento (check-out):** mesma tela atual, com as atividades e o efetivo
agrupados por responsável. Regras do fechamento inalteradas.

**Linha do tempo do turno:** "Check-in registrado" → abre a foto em modo leitura (mesma visão de
check-in do quadro, desenhada a partir de `dados`).

## 3. O quadro

Um único componente de visualização, usado em três entradas:
- `/obras/[obraId]/quadro` — planejador autenticado; tem o botão "Editar" (vai para a tela do turno).
- `/q/[codigo]` — público, só leitura, sem login; sem "Editar", sem telefones.
- Foto do check-in (seção 2) — desenha a partir do jsonb, sem setas nem atualização.

**Layout:** cabeçalho azul (`#002F6C`) com obra · dia da semana e data · período e o selo da etapa
(CHECK-IN laranja / CHECK-OUT / "Turno fechado"). Abaixo, uma faixa por responsável (nome e efetivo à
esquerda; atividades à direita, em duas colunas na tela larga). Faixa "Sem responsável" por último, só se
houver algo nela. No celular, as faixas empilham e as atividades ficam em uma coluna. Fontes maiores a
partir de telas largas (TV).

**Visão de check-in** (turno `planejado`): por atividade: descrição, local, quantidade planejada +
unidade, selo "EXTRA" quando não veio da programação. Por equipe: efetivo por função.

**Visão de check-out** (turno `em_campo`, `enviado` ou `fechado`): por atividade: descrição,
"realizado / planejado unidade", barra colorida (verde = concluída, amarelo = parcial, vermelho = não
iniciada; mesma regra de `statusAtividade`) e a causa quando houver. Por equipe:
- resumo "x de y programadas · z%" — só atividades **programadas** (ligadas à programação semanal) no
  percentual; as extras aparecem à parte como "+N extra". Se o turno não tem nenhuma atividade
  programada (obra sem programação), o resumo usa todas as atividades: "x de y concluídas · z%";
- pessoas e HH da equipe (soma do efetivo da equipe × duração do turno, mesma regra de `hhTurno`).

O percentual do RDO e do resumo do turno **não muda** (continua contando todas as atividades).

**Seletor de visão:** link discreto "Check-in | Check-out" no cabeçalho (via `?visao=`), para ver a
outra visão. Em turno `planejado` a visão de check-out não é oferecida. Em turno já liberado, a visão
de check-in é desenhada a partir da **foto do check-in** (o que foi combinado), não dos dados atuais;
turnos liberados antes desta entrega (sem foto) usam os dados atuais com o aviso "Check-in sem registro
oficial".

**Turno exibido** (função pura, testável): sem `?turno=`, escolhe na obra, no dia de hoje (fuso SP):
diurno se existir e não estiver `fechado`; senão noturno se existir; senão o diurno fechado de hoje;
sem turno hoje → o último turno da obra (por data/período) com o aviso "Sem turno hoje — mostrando
dd/mm período". Obra sem turnos → "Nenhum turno ainda". Setas ← → navegam para o turno anterior/seguinte
da obra (`?turno=`); botão "Agora" remove o parâmetro.

**Atualização:** componente cliente que pede a atualização dos dados do servidor a cada 30 s, só quando
a aba está visível, sem recarregar a página (conferir a API indicada em `node_modules/next/dist/docs/`).
Nada é guardado no navegador.

**Link público inválido** (código inexistente ou trocado) → página "Link desativado. Peça o link novo
ao planejador."

## 4. Link de campo (`/t/[token]`)

- Se o turno tem algum responsável (em atividades ou efetivo): abre na tela **"Quem é você?"** com
  botões grandes, um por responsável do turno (ordem alfabética), e **"Ver tudo"**. Se não tem nenhum,
  vai direto para a lista atual.
- A escolha fica na URL: `?r=[responsavel_id]` ou `?r=todos`. Um `r` que não pertence ao turno volta
  para a escolha. Topo da tela: "Lançando como **João** · Trocar".
- Com responsável escolhido: mostra e salva **só** as atividades e o efetivo da equipe dele (o servidor
  confere que cada atividade salva pertence a esse responsável; `lancado_por_id` = ele). Clima e
  horário real continuam visíveis e editáveis por todos (são do turno).
- **Botão "Enviar"** (hoje exige causa em todas as atividades do turno): aparece **só em "Ver tudo"**.
  Com responsável escolhido, a tela mostra "Terminou? Avise o planejador." no lugar. Assim nenhuma equipe
  fica travada pelas causas de outra. O turno continua editável pelo link depois de enviado, como hoje.
- "Ver tudo" = comportamento atual (lança tudo, sem `lancado_por_id`).

## 5. Erros e situações-limite

- Responsável desativado com atividades futuras: continuam com ele, exibido "(inativo)"; não aparece
  para escolha nova.
- Trocar o responsável depois de lançado: permitido; o lançado acompanha a atividade para a outra faixa.
- Dois responsáveis salvando efetivo ao mesmo tempo: sem conflito (escopos diferentes). Conflito só
  dentro da mesma equipe → mensagem atual de conflito.
- Responsável de outra obra enviado por API: recusado pelo gatilho (`responsavel_invalido`).
- Nome duplicado na mesma obra: "Já existe um responsável com esse nome nesta obra."
- Falha ao gravar a foto do check-in: a liberação é desfeita; mensagem "Não foi possível liberar o
  turno. Tente de novo."
- Excluir obra: responsáveis, fotos e link do quadro saem em cascata.

## 6. Testes

Padrão do projeto (TDD; vitest pelo PowerShell; integração/E2E com `SUPABASE_TEST=1`).

**Unitários (domínio puro, `lib/dominio/quadro.ts`):** agrupar atividades e efetivo por responsável
(ordem, faixa "Sem responsável" por último e só quando houver itens); resumo da equipe (programadas vs.
extras, turno sem programação, %, HH); escolha do "turno de agora" (diurno aberto, diurno fechado →
noturno, só noturno, sem turno hoje, sem turnos); anterior/seguinte; visão padrão pela situação;
validação do `?r=`.

**Integração (Supabase dev):** foto do check-in nasce ao liberar, com equipes e efetivo corretos, e não
nasce de novo; responsável de outra obra é recusado; `substituir_efetivo` com escopo só troca as linhas
da equipe e detecta conflito só nelas; criar turno/trazer da programação copia o responsável; código
antigo do quadro deixa de resolver depois de gerar um novo; salvar execução pelo link com `r` recusa
atividade de outra equipe.

**Ponta a ponta (Playwright):** cadastrar responsáveis → programar semana com responsáveis → criar turno
→ liberar → "Check-in registrado" na linha do tempo → abrir o link de campo, escolher o nome, lançar →
abrir o link público do quadro e ver a visão de check-out com a barra e o resumo da equipe.
