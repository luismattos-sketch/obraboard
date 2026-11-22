# Item 8 — "Informe a causa" só na hora certa

Data: 2026-11-22 · Branch: `causa-no-fim` · Tamanho: mudança pequena (sem migration prevista)

## Por quê

No teste de 2026-11-16, os quatro responsáveis (Ana, João, Carlos, Rita) e o planejador leram o vermelho
"Informe a causa para atividades não concluídas" como bronca: aparece às 7 h com tudo vazio e às 10 h com
3 de 8 tubos. O card tem ~470 px. Ao mesmo tempo, "✓ Terminei minha parte" não pede causa nenhuma: a equipe
encerra com atividade pela metade e a causa sobra para o planejador — dado incompleto, a dor nº 1 (e o card
que a IA vai preencher depois, itens 10.1/10.2).

## Objetivos

- Durante o dia, nenhum vermelho de causa; card curto (~200 px).
- A causa é cobrada do responsável no momento em que ele diz que terminou.
- Envio/fechamento continuam exigindo causa, como hoje.

Não objetivos: mudar a lista de causas, mexer no encerramento da semana, item 11 (clareza do lançamento).
Anti-objetivo: criar um segundo caminho de salvar a causa (perderia a proteção de sinal fraco/conflito/"Salvo ✓").

## Decidido com o Luis

1. **Cobrança no "Terminei minha parte"** (opção A). Ao tocar, se alguma atividade da equipe dele não estiver
   concluída e sem causa (ou "Outro" sem observação), o término **não** é registrado.
2. **Não dá para pular**: só registra com todas as causas da equipe informadas.
3. **Os próprios cards abrem** (opção 1): acima do botão aparece, em tom de alerta (não perigo),
   "Antes de terminar, informe a causa em:" com cada atividade ("Montagem de tubulação (3 de 8 tubo)") e um
   link "ir" que rola até o campo de causa do card. Esses cards abrem o campo de causa. Preenchida, a pessoa
   toca "Terminei" de novo (aí segue o fluxo de hoje, inclusive a pergunta das paradas abertas).

## Abordagens consideradas

- **Cards abrem (escolhida):** reaproveita o salvar do card (repetição, conflito, selo). Custo: rolar até o card.
- **Painel junto do botão:** mais cômodo, mas a causa ficaria editável em dois lugares; exigiria reescrever o
  estado do card. Descartada pelo risco.
- **Cobrar só no Enviar/Fechar:** simples, mas mantém a causa caindo no planejador.

## Card (componente único, campo e planejador)

- Durante o dia: sem campo de causa nem observação abertos; abaixo do Executado, links discretos
  "Não vai dar para concluir? Informar causa" (só em atividade programada não concluída) e "+ Observação".
- Abre sozinho se já houver causa / observação, ou quando a cobrança pede (Terminei, Enviar, Fechar).
- Mensagem de erro do card só aparece depois de uma cobrança, e em tom de alerta.

## Minhas decisões (conferir)

- **Planejador:** mesmo card curto. A caixa perto de "Fechar turno" passa a dizer "Antes de fechar, informe a
  causa em:", com o mesmo "ir"; os cards pendentes abrem a causa ao tentar fechar.
- **"Ver tudo" / "Enviar turno" no campo:** mesma regra; o botão deixa de ficar desabilitado e, ao tocar com
  pendência, mostra a lista e abre os cards (hoje fica cinza sem explicar).
- **Servidor:** `marcarTerminouCampo` relê as atividades da equipe e recusa com "Informe a causa das
  atividades não concluídas antes de terminar." se faltar causa (protege aba antiga em outro celular).
- Extra e adiantada continuam sem pedir causa. Equipe sem atividade pendente: "Terminei" igual a hoje.
- "Desfazer" o término não muda nada nas causas.

## Junto no mesmo PR (regra do AGENTS.md)

- Manual: `lib/ajuda/conteudo/campo.ts` (Terminei pede causa), `fechar-turno.ts` (novo texto da caixa e o
  link "Informar causa"; o `alvo` da captura muda porque o combobox fica fechado).
- Capturas: `SUPABASE_TEST=1 npm run manual:capturas` (capítulos campo e fechar-turno).
- Novidades: uma linha em `lib/ajuda/novidades.ts`.
- Fluxograma: conferir se a sequência do campo muda (provável acréscimo "informar causa" antes de "Terminei").

## Para quem constrói

- Regra de "o que falta" continua em `errosDeCausa` (`lib/dominio/regras.ts`), filtrada pela equipe no Terminei.
- Ajustar E2E que procuram o combobox de causa sempre visível e o texto antigo.
