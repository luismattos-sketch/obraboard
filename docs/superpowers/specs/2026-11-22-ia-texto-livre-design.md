# IA no campo: texto livre vira lançamento (backlog 10.1 + 10.2)

Data: 2026-11-22 · Status: rascunho para aprovação

## Por quê

Dor nº 1 dita pelo Luis: a informação do campo chega incompleta (falta dado, o responsável não sabe escrever,
não registra). O responsável escreve (ou dita pelo microfone do teclado do celular) do jeito dele — "fizemos 30 m de
tubulação, faltou andaime" — e a IA transforma em lançamento das atividades, perguntando o que falta com 1–2 botões.
RDO por voz/texto já é o mínimo esperado no mercado; o diferencial do Frentia é o registro confiável para o
Relatório da Obra, então a IA **nunca inventa** e **nunca grava sozinha**.

## Objetivos

- No link de campo (`/t/[token]`), com responsável escolhido, uma caixa "Conte como foi o dia" + botão "Organizar".
- A IA preenche, nas atividades **daquele responsável**: quantidade feita, concluída, causa e observação do que não
  terminou.
- Prévia "A IA entendeu:" com até 2 perguntas de botão; nada é gravado até o responsável tocar **Lançar**.
- O texto original fica guardado junto ao turno e o planejador o vê na página do turno.

## Não-objetivos (desta entrega)

- Paradas (horário, gente parada), efetivo, clima, horário real — fica para depois (paradas retroativas = próximo
  passo natural, "B" da conversa).
- Transcrição de áudio no servidor (a voz é do teclado do celular).
- Modo "Ver tudo" e tela do planejador sem caixa de IA.
- Cobrança/plano pago: liberado para todos no piloto, só com limites de gasto.
- Criar atividades novas (extra) pelo texto.

## Anti-objetivos (seria fracasso mesmo funcionando)

- A IA atribuir número, causa ou atividade que ninguém disse.
- Gravar algo sem o toque em "Lançar".
- Perder o texto digitado por falta de sinal ou falha da IA.
- Mais de 2 perguntas, ou perguntas em texto livre (conversa).

## Abordagens consideradas

1. **IA só interpreta; código confere e grava (escolhida).** Servidor manda texto + atividades + lista de causas;
   a IA devolve formato fixo; o código valida e monta prévia e perguntas; gravar usa o caminho atual dos cards.
   Previsível, barato, IA não consegue gravar nem inventar ids/causas. Custo: código de validação.
2. Conversa (chat) com a IA: mais flexível, mas caro, lento com sinal fraco, imprevisível, foge de "1–2 botões".
3. Regras de texto sem IA: custo zero, mas quebra com linguagem solta do canteiro; não resolve a dor.

O Luis escolheu a 1.

## Decisões tomadas com o Luis

- Escopo A: só o fechamento das atividades (quantidade, concluída, causa, observação).
- Conferência por **prévia com confirmação** (não preenche os cards direto).
- O **texto original é guardado** (tabela nova) e visível ao planejador.

## Desenho

### Fluxo na tela (link de campo, responsável escolhido, turno `em_campo`/`enviado`)

```
Conte como foi o dia
[fizemos 30 m de tubulação, faltou andaime        ]
[Organizar]

A IA entendeu:
• Tubulação linha 3 — 30 m de 50 m (parcial)
• Causa do que faltou: andaime é…  [Falta material] [Equipamento] [Outra]
• Suporte de tubo — você não falou nada (fica como está)
[Lançar]  [Corrigir texto]
```

- A caixa fica no alto do bloco de atividades. Não aparece em "Ver tudo", em turno somente leitura, nem se a pessoa
  não tem atividades no turno.
- "Organizar" chama uma server action; enquanto espera, "Organizando…". Uma atividade do responsável que o texto não
  cita aparece como "você não falou nada (fica como está)" — nunca é alterada.
- **Lançar** só habilita quando as perguntas foram respondidas. Ao lançar, cada atividade alterada é gravada pelo
  mesmo `salvarExecucao(token, id, dados, esperado, responsavelId)` dos cards, com o mesmo rastreio de salvamento
  (fila de repetição, "Salvando…"/"Salvo", conflito "Ver valor atual"). Os cards refletem os novos valores.
- **Corrigir texto** volta para a caixa com o texto, sem gravar.
- O que a IA não conseguiu resolver (além de 2 perguntas, ou nada dito) aparece na prévia como "falta: …" e o
  responsável completa no card, como hoje. A cobrança de causa (item 8) continua valendo no Terminei/Enviar.

### O que a IA recebe e devolve

Entrada (montada no servidor a partir do token, nunca do navegador): texto (até ~1.000 caracteres), atividades do
responsável no turno (id curto local, descrição, local, unidade, qtd planejada, qtd já lançada, causa e observação
atuais), lista de causas do app (`CAUSAS`).

Saída em formato fixo (saída estruturada / ferramenta com esquema), por atividade citada:
- `atividade` (id da lista) ou lista de candidatas quando ambíguo;
- `quantidade` + `modo` (`total` | `a_mais` | `incerto`) ou `concluida: true`;
- `causa` (uma da lista) ou candidatas (até 2) quando ambíguo; `trecho` literal do texto para a observação;
- nada inventado: campo não dito vem vazio.

Modelo: `claude-haiku-5-5` (rápido, barato). Instrução fixa: português, só extrair o que foi dito, nunca deduzir
números, trecho da observação copiado literal.

### Conferência no código (função pura, testada)

- Descarta atividade fora da lista do responsável, causa fora de `CAUSAS`, número negativo/absurdo
  (mesmos limites de `validacao.ts`); o descarte vira "falta" na prévia, nunca erro.
- Monta as perguntas, na ordem de prioridade, no máximo 2 por texto:

| Quando | Pergunta | Botões |
|---|---|---|
| Atividade ambígua | "Qual …?" | as candidatas (até 3) |
| Causa ambígua | "<coisa> é…" | as 2 candidatas + "Outra" (Outra = causa "outro") |
| Já havia lançamento e o modo é incerto | "30 m a mais ou no total?" | "Somar (70)" · "Trocar (30)" |
| Atividade citada sem número | "Quanto de <atividade>?" | "Tudo (50 m)" · campo número |

- "terminamos/concluímos" → concluída (qtd = planejada, mesma regra do "✓ Concluída" do item 11).
- Observação = trecho literal; se já havia observação, junta com " · " (não apaga a anterior).
- Causa só é aplicada quando a atividade fica não concluída (mesma regra dos cards).
- Prévia mostra antes → depois por atividade ("0 → 30 m de 50 m").
- **Base do Somar/Trocar e do "antes"** (decisão minha): o valor do card na hora do Lançar. Se uma atividade mudou
  entre "Organizar" e "Lançar" (outro aparelho, edição no card), ela não é gravada e a prévia mostra "mudou desde
  a prévia — organize de novo"; as demais seguem.
- **Atividades extra/adiantada/atrasada** (decisão minha): entram na lista. Extra não tem meta: sem botão
  "Tudo (…)", sem "concluída"; extra e adiantada não recebem causa (mesma regra `!a.tipo` dos cards).
- **Observação longa** (decisão minha): o trecho literal respeita o limite de 500 caracteres de `validacao.ts`; se
  junto com a observação anterior passar do limite, a prévia mostra "observação grande demais — complete no card"
  e a observação daquela atividade não é alterada (as demais mudanças seguem).

### Texto original guardado

Tabela nova `relatos_campo` (migration, aplicar em DEV e PROD pelo SQL Editor):
`id`, `turno_id`, `responsavel_id`, `texto`, `criado_em`, `atualizado_em`, `tentativas` (int), `lancado` (bool: o
responsável tocou Lançar). RLS: leitura pela empresa dona da obra (planejador); escrita só pelo servidor (admin,
validando o token, como as demais ações do campo).

Regras (decisões minhas a partir da revisão):
- O texto é gravado **antes** de chamar a IA, no toque em "Organizar" — assim, se a IA falhar ou a aba recarregar,
  o texto não se perde. Ao reabrir o link, a caixa volta preenchida com o último relato **não lançado** daquele
  responsável no turno. (Texto digitado e nunca "Organizado" ainda pode se perder ao recarregar — sem localStorage,
  pela regra do projeto.)
- Um relato por rodada: "Corrigir texto" + "Organizar" de novo **atualiza a mesma linha** (texto novo,
  `tentativas + 1`). Depois de "Lançar", o próximo texto abre uma linha nova. O planejador vê o texto final de cada
  relato.
- `lancado` vira true no toque em "Lançar" (= o responsável confirmou). Cada card mostra seu próprio estado de
  gravação (fila, conflito) como hoje; falha num card não desfaz o relato.
- O limite de uso conta `tentativas` (inclusive as que a IA não respondeu).

Planejador: na página do turno, seção recolhida "O que o campo escreveu" (responsável, hora, texto, selo
"lançado"/"não lançado"). Não entra no RDO por ora.

### Falhas, sinal fraco e limites

- Sem conexão ou erro da IA: texto continua na caixa; aviso "Não deu para organizar agora — tente de novo ou lance
  nos cards". Nada é gravado. (Organizar não entra na fila automática: só a gravação do Lançar usa a fila.)
- Tempo-limite da chamada à IA ~20 s.
- Limite por turno: até 20 "Organizar" por responsável por turno (contado em `relatos_campo`); acima disso,
  "Limite de uso da IA neste turno — lance nos cards". Somado ao limite mensal da Claude Console.
- Chave `ANTHROPIC_API_KEY` só no servidor. Sem chave configurada, a caixa não aparece.

### Manual e Novidades (regra do AGENTS.md)

- Capítulo do link de campo em `lib/ajuda/` ganha "Contar o dia com a IA"; captura nova; "Como usar" do campo
  menciona a caixa; linha em `lib/ajuda/novidades.ts`. Fluxograma só se mudar a sequência (não muda: é atalho).
- Nos testes E2E e nas capturas, a IA é substituída por resposta fixa (sem chamada real).

### Testes

- Unidade (vitest): conferência/perguntas/montagem da prévia com respostas de IA fabricadas (ambígua, inventada,
  sem número, somar/trocar, concluída, causa fora da lista).
- Integração (`SUPABASE_TEST=1`): `relatos_campo` + limite por turno + RLS de leitura.
- E2E: digitar → prévia → responder pergunta → Lançar → cards salvos; falha da IA mantém o texto.
- Um teste manual com a IA real no DEV, com 5–10 frases de canteiro.

## Deixado para quem constrói

- Formato exato do esquema e do texto de instrução da IA; forma de substituir a IA nos testes.
- Componentes e nomes de arquivos; posição exata da seção no planejador.
- Texto final dos avisos, seguindo o tom dos itens 8 e 11.
