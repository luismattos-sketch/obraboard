# 5.4 — Roteiro guiado do LPS (roteiro da semana + pauta da reunião)

Épico 5, item 5.4. Conversado com o Luis em 2026-11-27. Ele quer "meio que os três": ensinar o método a quem não conhece, dar pauta à reunião semanal e conduzir a rotina da semana. Escolheu a abordagem A.

## Por quê
As peças do LPS já existem (Lookahead, restrições, programação, check-in/out, encerramento com PPC e causas), mas cada uma numa tela e nada diz "o que fazer agora". O roteiro conduz sem travar ninguém.

## Abordagens
- **A. Painel "Roteiro da semana" na página da obra + "Pauta da reunião" + capítulo "O método LPS"** — escolhida. Calculado dos dados que já existem; não incomoda quem já sabe.
- B. Assistente passo a passo (tela a tela) — cansa quem já conhece, briga com o uso diário.
- C. Só conteúdo na Ajuda — ensina, mas não conduz nem serve de pauta.

## Objetivos
1. **Painel "Roteiro da semana"** no topo da página da obra (`/obras/{id}`), semana atual (seg–dom, fuso SP). Passos, na ordem do método, cada um com situação calculada, um botão para a tela certa e "Por que isso?" (1–2 linhas, recolhido):
   1. **Encerrar a semana passada** — ✓ se a semana anterior está encerrada (mostra o PPC); ! se programada e não encerrada; some se a obra não tinha semana anterior programada. Botão → semana anterior.
   2. **Olhar o Lookahead** — ! se há restrições vencidas ("N vencidas"); ○ se há restrições abertas ("N abertas"); ✓ se nenhuma aberta. Botão → Lookahead.
   3. **Programar a próxima semana** — ✓ se a semana seguinte está programada; ○ se rascunho ou inexistente. Botão → abre/cria a semana seguinte.
   4. **Turno de hoje** — ○ "Check-in" se o turno de hoje está planejado; ○ "Fechar o turno" se em campo/enviado; ✓ se fechado; some se não há turno hoje. Botão → turno.
   Selo de situação: ✓ sucesso, ○ neutro, ! alerta. Botão "Abrir pauta da reunião".
2. **Pauta da reunião** (`/obras/{id}/reuniao`): página só de leitura, pronta para projetar, na ordem:
   1. Semana passada: PPC, cumpridas/total, causas das não cumpridas (agrupadas, com contagem).
   2. Restrições abertas, vencidas primeiro, agrupadas por responsável (item do lookahead, descrição, prazo).
   3. Lookahead das próximas 3 semanas: itens por semana com contagem de restrições abertas (sem botões de edição).
   4. Próxima semana: situação (sem programação/rascunho/programada) e botão para a programação.
   Botão "Imprimir" (window.print) com CSS de impressão simples.
3. **Capítulo "O método LPS"** na Ajuda (novo, no índice, depois de "Primeiros passos"): o que é, o ciclo (lookahead → restrições → compromisso semanal → execução diária → PPC e causas → aprender), como cada passo aparece no Frentia, como conduzir a reunião com a pauta. "Por que isso?" de cada passo do painel linka para a seção certa.

## Não objetivos / anti-objetivos
- Nada bloqueia; nada é obrigatório; sem notificações/WhatsApp.
- Sem tabela nova nem migration (tudo calculado).
- Não registrar ata da reunião (fica para depois, se pedirem).

## Restrições
- Sem localStorage; "responsável", nunca "encarregado"; evitar "pleito".
- Manual, capturas (painel e pauta), fluxograma (passo "Reunião semanal" na seção "Toda semana") e Novidades.

## Decisões minhas (o Luis pode corrigir)
- Painel no topo da página da obra, sempre visível (não recolhível).
- Semana "atual" = a que contém hoje; "passada" = anterior; "próxima" = seguinte.
- Pauta mostra 3 semanas de lookahead (não 4) para caber na tela da reunião.
- Causas agrupadas pelos rótulos já usados no app.

## Fica para o construtor
Layout exato, nomes de componentes, consultas (reaproveitar `obterSemana`, `resumoSemanaAnterior`/`listarSemanasComResumo`, `listarRestricoesDaObra`, `listarItensCronograma`, turnos da obra), regras puras testáveis em `lib/dominio/roteiro.ts`.
