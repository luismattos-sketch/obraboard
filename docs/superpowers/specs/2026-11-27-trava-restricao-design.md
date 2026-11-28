# 5.3 — Atividade com restrição aberta entra só com motivo

Épico 5, item 5.3. Conversado com o Luis em 2026-11-27 (opção B: aviso com justificativa, não bloqueio).

## Por quê
Regra do LPS: só se compromete com o que está livre. Na montagem industrial a exceção é semanal; forçar "Removida" falso estraga o dado. Então: avisar, exigir o motivo, marcar a atividade e medir depois se compensou.

## Desenho
- `programacao_atividades.justificativa_restricao text` (1–300), gravada só na inclusão ou ao programar; entra na foto oficial (`foto_semana`) para valer na semana encerrada.
- **Levar para esta semana:** item com restrição aberta → formulário mostra as restrições abertas e o campo obrigatório "Por que entra mesmo assim?". O servidor recusa a inclusão sem motivo se o item tiver restrição aberta.
- **Programar semana:** atividades ligadas a item com restrição aberta e sem motivo são listadas; um motivo único vale para todas (decisão minha); depois programa. Sem motivo, não programa.
- **Na semana:** selo "Entrou com restrição" + motivo (rascunho e semana programada). O selo fica mesmo se a restrição for removida depois (decisão minha).
- **Análise:** bloco "Entraram com restrição": atividades no período e quantas cumpridas, ao lado do cumprimento geral.
- Fora: atividades criadas direto na semana; bloqueio duro; aviso ao cliente.
- Manual (passo no capítulo Programar a semana) e Novidades.

## Abordagens
Um caminho: motivo na atividade da semana. No item do lookahead não serve (o mesmo item vai a várias semanas com motivos diferentes).
