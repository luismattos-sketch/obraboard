# Item 1.6 — Atividade não concluída volta para a programação seguinte

Data: 2026-11-24 · Planilha "Backlog Frentia", item 1.6

## Por quê

Hoje o saldo passa de turno para turno só dentro da semana (regra meta ÷ dias e sequências do T.19). O que
sobra no fim da semana some: o planejador precisa redigitar a atividade na semana seguinte, com risco de
esquecer ou errar a quantidade.

## Objetivo

No rascunho da semana N, o planejador vê o que ficou com saldo na semana N−1 e traz cada item com um toque,
já preenchido, com meta = saldo.

**Não é objetivo:** trazer automaticamente sem o planejador; mudar o PPC da semana anterior (ela continua
"não cumprida", com sua causa); carregar saldo de semanas mais antigas que N−1; mexer na regra dentro da semana.

**Anti-objetivo:** meta de semana programada mudando sozinha.

## Abordagens

- **A (escolhida pelo Luis em 2026-11-24):** "Trazer" usa o saldo do momento. Se a semana anterior ainda lançar
  execução depois, a atividade trazida mostra "Saldo mudou: era 20 m, agora 12 m" com o botão "Atualizar meta".
  O planejador decide.
- B: a meta trazida acompanha o saldo sozinha até a nova semana começar a lançar (como no T.19). Descartada:
  meta de semana travada mudaria sem ação de ninguém.

## Como funciona

**Onde aparece.** Na tela da semana em rascunho, bloco "Não concluídas da semana anterior" acima da lista,
só se a semana N−1 (segunda − 7 dias) existe, não é rascunho, e tem algum item com saldo > 0.
Cada linha: descrição · local · saldo com unidade (ex.: "faltam 20 m de 120 m") · responsável · botão **Trazer**.
Item já trazido para esta semana mostra "Trazida ✓" no lugar do botão.

**Saldo.** O mesmo do acompanhamento da semana (`resumirSemana`: meta − realizado em turnos enviados/fechados,
mínimo 0). Semana N−1 encerrada usa a foto oficial (`dadosOficiais`). Sequência do T.19 conta como um item:
saldo = Σ metas − Σ realizado dos membros; os dados pré-preenchidos vêm do último membro.

**Trazer.** Abre o formulário de inclusão pré-preenchido (como o "Duplicar"): descrição, local, unidade,
equipe, responsável, período e dias iguais aos da origem; meta = saldo. O planejador ajusta dias/meta e salva.
A nova atividade guarda a origem (`trazida_de`, a atividade de N−1; na sequência, o último membro) e o saldo
no momento (`saldo_trazido`). Uma origem só pode ser trazida uma vez por semana.

**Saldo mudou.** Na semana N (rascunho ou programada), se o saldo atual da origem ≠ `saldo_trazido`, a
atividade mostra "Saldo da semana anterior mudou: era X, agora Y" e o botão **Atualizar meta**
(meta = Y, `saldo_trazido` = Y). Se Y = 0, o texto diz que a semana anterior concluiu e sugere remover.

**Semana programada (decisão minha, para conferir).** A semana programada é travada no banco. Proponho uma
exceção estreita: "Atualizar meta" pode rodar na semana programada só para atividade trazida, só trocando a
meta pelo saldo atual da origem, e só se a atividade ainda não tem execução lançada. Fora disso, continua
valendo "Reabrir semana".

**Apagar.** Se a origem for apagada, `trazida_de` vira nulo e o aviso some (a atividade fica normal).

## Manual

Seção "Programar a semana" ganha "Trazer o que ficou da semana anterior"; captura nova; linha em Novidades;
fluxograma só se mudar a sequência (não deve mudar).

## Fica para quem constrói

Nomes de componentes e de função no banco; texto exato dos avisos (tom neutro, "Responsável", sem "pleito").
