# Iniciar turno por equipe e clima de volta no campo — design (curto)

Data: 2026-11-23 · Pedido de Luis (correção do item 10)

## Por quê
O item 10 passou horário real e clima para o planejador. Na prática, quem sabe a hora exata em que a equipe
começou é o responsável no campo, e o clima também é visto por ele. O horário digitado depois pelo planejador
é impreciso (o início chegava "07:00" sem ninguém preencher).

## Objetivos
- Botão **"Iniciar turno"** para cada responsável, gravando a hora do toque (por equipe).
- Fim por equipe continua sendo o **"Terminei minha parte"** (já grava a hora do toque).
- Horário real do turno = **primeiro início** e **último Terminei** entre as equipes; recalculado a cada
  iniciar / terminar / desfazer. Iniciar mexe só no início; Terminei só no fim, e nunca apaga um fim já gravado
  (só o Desfazer limpa) — correção do planejador sobrevive (revisão final).
- **Clima volta editável** no campo para o responsável (como antes do item 10). Vale para o turno todo; o último
  a salvar prevalece. "Ver tudo" continua só leitura.
- Quadro e página do turno mostram por equipe "iniciou HH:MM · terminou HH:MM".

## Não objetivos
- HH por janela de cada equipe (continua a janela do turno) — anotar no backlog.
- Item 19 (atividades contínuas entre turnos) — próximo trabalho, separado.
- Iniciar não bloqueia lançamento (esquecer de tocar não trava ninguém).

## Abordagens consideradas
1. **Registro por equipe espelhando `turno_equipes_terminadas`** (escolhida): tabela `turno_equipes_iniciadas`
   (turno_id, responsavel_id, iniciou_em), mesmo fluxo de marcar/desfazer, servidor recalcula
   `hora_inicio_real`/`hora_fim_real` do turno.
2. Gravar direto em `turnos.hora_inicio_real` — descartada: não guarda a hora de cada equipe (Luis escolheu por equipe).
3. Responsável digitar a hora — descartada: perde a "hora exata" do toque.

## Decisões de Luis
- Início **por equipe**.

## Minhas decisões (corrigíveis)
- Hora vem do aparelho no momento do toque (mesmo padrão do Terminei), validada no servidor.
- Turno sem responsáveis (fluxo antigo, um só no campo): o botão Iniciar grava sem equipe? Não — nesse caso
  mantém o bloco de horário editável do fluxo antigo.
- Repetir o toque (rede instável) é sucesso; o primeiro horário gravado vale.

## Inclui
Migração, ações de campo, componentes, quadro/página do turno, testes (unidade/integração/e2e), manual
(`lib/ajuda/`), capturas, fluxograma se a sequência mudar, linha em Novidades, deploy na Vercel.
