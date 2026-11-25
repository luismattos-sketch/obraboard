# Quadro: resumo do turno (anel + ritmo) e PPC dia a dia na Análise

Data: 2026-11-24 · continuação dos itens 2.4/2.5 · tamanho: pequeno

## Por quê
O quadro (planejador e TV) deve responder em 3 segundos **"vamos fechar o dia?"**. O "PPC do mês" não responde isso
e cabe melhor na Análise PPC, junto do "PPC por semana".

## O que muda
1. **Sai do quadro** o bloco "PPC do mês" (`PpcDoMes`) e a leitura dos turnos fechados do mês em `prepararQuadro`.
2. **Entra no topo do quadro** (abaixo do aviso/paradas, acima das faixas), só na visão **check-out**, o bloco
   "Resumo do turno":
   ```
   ( 57% )   4 de 7 concluídas · no vermelho          Tempo do turno  ██████████░░░░  62% (07:00–17:00, agora 13:12)
   (anel)    ■ 4 concluídas ■ 2 em andamento ■ 1 não iniciada      Avanço do dia   ███████░░░░░░░  45%  ⚠ abaixo do ritmo
                                                                     Aderência da obra: 78% (desde o início)
   ```
   - **Anel (A):** concluídas ÷ programadas do turno (mesma regra do "Cumprimento do dia": extra e adiantada fora),
     cor pelo farol (verde ≥ 80%, amarelo 60–79%, vermelho < 60%) e contagem por situação.
   - **Ritmo (B):** "Tempo do turno" = fração da janela prevista já passada (`agoraDoTurno`; antes do início 0%,
     depois do fim 100%). "Avanço do dia" = média de min(realizado ÷ planejado, 1) das atividades programadas.
     "⚠ abaixo do ritmo" quando avanço < tempo − 15 pontos; "no ritmo" caso contrário.
     Turno fechado: a barra de tempo some e o texto vira "Resultado final".
   - **Aderência da obra:** concluídas ÷ programadas de todos os turnos fechados da obra desde o início, numa linha
     discreta; "sem turno fechado" quando não houver.
   - No celular, anel e barras empilham. Na visão check-in, só a linha da aderência da obra.
3. **Análise PPC** ganha "PPC dia a dia" abaixo de "PPC por semana": o mesmo gráfico de barras com farol, cobrindo os
   dias do período escolhido (4/8/12 semanas), mais a aderência do período. Reaproveita `ppcDoMes`
   (generalizado para um intervalo de datas) e o componente de barras.

## Abordagens consideradas
A (só anel), B (só ritmo), C (anel por equipe). Escolhido **A + B** pelo Luis: o anel diz quanto foi concluído,
o ritmo diz se ainda dá tempo. C repetia o "x de y" das faixas.

## Fora
Previsão de hora de término; gráfico por equipe; mudança no RDO. Manual (capítulos quadro-tv e análise),
capturas e Novidades atualizados no mesmo PR.

## Decisões minhas (corrigíveis)
Limite "abaixo do ritmo" = 15 pontos; resumo só no check-out; aderência da obra = turnos fechados desde o primeiro.
