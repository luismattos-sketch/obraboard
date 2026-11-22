# Teste de usabilidade — João Lima (mecânica), link de campo no celular

Data: 16/11/2026 · Turno diurno · Pixel 7 (Playwright) · Supabase de desenvolvimento
Specs: `specs/21-joao-1-abrir.spec.ts`, `21-joao-2-lancar.spec.ts`, `21-joao-3-aviso-quadro.spec.ts`
Log bruto: `notas/joao-log.jsonl` · Capturas: `shots/joao-*.png`

## Medições

| Tarefa | Toques | Tempo até "Salvo ✓" | Obs. |
|---|---|---|---|
| Abrir link (carregar "Quem é você?") | 0 | 3,0 s (carga) | ok |
| Identificar-se (João Lima) | 1 | 1,9 s | ok, botões grandes |
| Efetivo: 3 Mecânico | 5 | 2,0 s | lista de funções boa (vem da programação) |
| "2 parados esperando peça" (gambiarra via "Outra função…") | 8 | — (ver A3) | não existe campo para isso |
| B-301: 0,1 un + Material + observação | 6 + digitação | 2,1 s | sem foto, sem horário da parada |
| VTI-02: 0 + Atividade predecessora + observação | 6 + digitação | 1,9 s | sem como apontar a equipe culpada |
| Volta do sinal (offline → online) | 0 | 1,4 s | reenvio automático funcionou |
| Avisar o planejador na hora | impossível | — | não há botão/ação |

Erros de console: nenhum no fluxo normal; só `net::ERR_INTERNET_DISCONNECTED` esperado durante o teste sem sinal. Quadro público: 0 erros.
Persistência: depois de recarregar, quantidades, causas, observações e efetivo voltaram certinhos.

## Achados

### A1. Não há como avisar o planejador na hora que parou — BLOQUEIA (objetivo do João)
- Onde: rodapé do link de campo (modo responsável).
- O que aconteceu: o único elemento é o aviso fixo "Terminou? Avise o planejador." — não é botão, não tem telefone, WhatsApp, nem notificação. Botões na tela: só "✓ Concluída", "✕", "+ Adicionar função"; links: só "Trocar". O João precisa sair do app e ligar/mandar mensagem por fora, e o registro dele não marca a hora em que avisou.
- Evidência: `shots/joao-31-rodape-avise.png`; log `procurar-aviso` (telLinks: 0).
- Sugestão: botão "Avisar planejador agora" no cartão da atividade quando houver causa (gera alerta no quadro do planejador com carimbo de hora) ou, no mínimo, link `tel:`/WhatsApp do planejador. O texto "Terminou? Avise…" também confunde: no meio do turno a pergunta não se aplica.

### A2. O quadro do gestor não deixa claro que a parada foi por causa externa — ATRAPALHA (forte)
- Onde: quadro público `/q/…` (TV e celular).
- O que aconteceu: aparece só "Causa: Material" e "Causa: Atividade predecessora", em vermelho, igual à "Causa: Mão de obra" da Rita (essa sim interna). A observação detalhada (rolamento 6312, RM 4471, parado desde 10:40, elétrica não liberou) **não aparece**. João fica com "0 de 2 programadas · 0%", visualmente tão "culpado" quanto qualquer equipe. Não há ligação entre o VTI-02 do João (0/1) e o lançamento de cabos do VTI-02 do Carlos (0/60 m), que está logo acima.
- Evidência: `shots/joao-40-quadro-publico-tv.png`, `shots/joao-41-quadro-publico-celular.png`, `notas/joao-quadro-publico.txt` (não contém "Rolamento").
- Sugestão: separar causas "externas à equipe" (material, predecessora/outra equipe, liberação de área, clima) com cor/ícone diferente de "internas"; mostrar a observação (ou as primeiras palavras) no quadro; permitir vincular a atividade bloqueadora ("aguardando: Lançamento de cabos do VTI-02 — Carlos").

### A3. Não existe como registrar gente parada/ociosa — ATRAPALHA
- Onde: bloco Efetivo.
- O que aconteceu: só há função + quantidade. Para dizer "2 dos 3 parados esperando peça" a saída foi "Mecânico 1" + "Outra função… → 'Mecânico parado aguardando peça' 2". Funciona, mas suja a lista de funções e o quadro conta os parados como produtivos: "3 pessoas · 30,0 HH". O nome digitado fica cortado no celular ("Mecânico parado aguardan…").
- Evidência: `shots/joao-11-efetivo-parados-gambiarra.png`, `shots/joao-23-apos-reload.png`, quadro mostra 30,0 HH.
- Sugestão: por linha de efetivo, campo "parados (horas ou pessoas)" com motivo, ou vincular HH ociosa à causa da atividade. Isso é exatamente a prova que o responsável quer ("minha equipe estava disponível").

### A4. Lista de causas: falta "dependência de outra equipe" e o termo "Atividade predecessora" é jargão — ATRAPALHA
- Onde: "Causa do não cumprimento" (9 opções: Material, Mão de obra, Equipamento, Projeto/Informação, Clima, Atividade predecessora, Liberação de área/Interferência, Segurança, Outro).
- O que aconteceu: para "a elétrica não liberou o motor" fiquei em dúvida entre "Atividade predecessora" e "Liberação de área/Interferência". Um responsável de campo não fala "predecessora". Nenhuma opção permite apontar QUAL equipe/atividade travou. "Material" não distingue "não chegou do almoxarifado" de "equipe pediu errado".
- Sugestão: renomear para "Aguardando outra equipe/atividade" (com ajuda curta em cada opção) e, quando escolhida, mostrar lista das equipes/atividades do turno para vincular. Subcausa opcional em Material (não entregue / errado / faltou pedir).

### A5. Sem foto e sem horário da parada no registro — ATRAPALHA
- Onde: cartão da atividade.
- O que aconteceu: não existe campo de anexo (`input[type=file]` = 0) nem hora da parada; tudo vai digitado na Observação ("Parou às 10:40…"). Foto da bomba desmontada/da requisição seria a evidência mais forte para o João. A "foto do check-in" que existe no app não está no link de campo.
- Evidência: log `b301-campos-extras` (inputsArquivo: 0, camposHoraNoCard: 0).
- Sugestão: botão "📷 Foto" (câmera) por atividade e campo "Parou às" que já sugere a hora atual.

### A6. "Salvo ✓" antigo continua na tela depois de nova edição (~0,75 s) — ATRAPALHA (risco de perda)
- Onde: indicador de salvamento do cartão (e do efetivo).
- O que aconteceu: após editar de novo, durante o debounce de 800 ms o texto continua "Salvo ✓" e só depois vira "Salvando…" (amostras a cada 150 ms: Salvo, Salvo, Salvo, Salvo, Salvo, Salvando…). Quem digita e bloqueia o celular nesse intervalo vê "Salvo" sem estar salvo (há proteção no `visibilitychange`, mas a mensagem engana). No efetivo isso fez minha medição achar "Salvo" em 127 ms — falso positivo.
- Evidência: log `indicador-durante-debounce`, `efetivo-gambiarra-parados`.
- Sugestão: ao mudar o valor, trocar imediatamente para "Alterações não salvas…/Salvando…".

### A7. Campos do turno inteiro (Horário real, Clima) ficam abertos para cada responsável — ATRAPALHA (interferência)
- Onde: topo ("Horário real") e "Clima" na tela do João.
- O que aconteceu: ao abrir, o Início estava vazio; minutos depois apareceu "07:00" sem eu ter preenchido — outro responsável escreveu no campo do turno. Esses campos são um só para todos; quatro pessoas podem sobrescrever o horário/clima umas das outras e cada uma pensa que é o "seu" horário. Para o João, o horário real da equipe dele (parada 10:40) não cabe ali.
- Evidência: `resultados/…joa-fadeb…/error-context.md` (Início: 07:00) vs `shots/joao-23-apos-reload.png` (vazio).
- Sugestão: no modo responsável, mostrar horário/clima como leitura ("definido pelo planejador/por Ana") ou registrar horário por equipe.

### A8. Qualquer pessoa do link pode lançar no nome de outro ou em "Ver tudo" — ATRAPALHA (confiança do registro)
- Onde: "Quem é você?" / "Trocar" / "Ver tudo".
- O que aconteceu: não há confirmação de identidade; "Ver tudo" mostra 5 botões "✓ Concluída" de todas as equipes, efetivo de todos e "Enviar turno". O Carlos (elétrica) poderia mudar a causa do VTI-02 do João, e o registro "não foi culpa minha" perde valor. Não testei alterar dados de terceiros (regra).
- Evidência: `shots/joao-32-ver-tudo.png`; log `ver-tudo-botoes`.
- Sugestão: no mínimo, histórico "alterado por <nome> às hh:mm" por atividade; idealmente "Ver tudo" só leitura no campo.

### A9. Aviso vermelho antes de qualquer lançamento — DETALHE
- Onde: cada cartão, logo ao abrir.
- O que aconteceu: "Informe a causa para atividades não concluídas" em vermelho aparece com tudo vazio, às 7h, antes de começar. Parece erro.
- Evidência: `shots/joao-03-tela-joao-inteira.png`.
- Sugestão: só mostrar depois que a pessoa lançar quantidade ou no fim do turno; ou tom neutro.

### A10. Meta "0,5 un" difícil de expressar avanço parcial — DETALHE
- Onde: B-301, "Previsto: 0,5 un".
- O que aconteceu: para "desmontagem feita, falta montar" tive de inventar "0,1 un". Em revisão de bomba o avanço é por etapa, não por fração de unidade.
- Sugestão: permitir avanço em % ou etapas (planejamento) — ou mostrar "% do previsto" ao lado do campo.

### A11. Observação pequena para texto longo — DETALHE
- Onde: campo Observação (2 linhas, máx. 500 caracteres, sem contador).
- O que aconteceu: o texto da causa fica cortado e é preciso rolar dentro da caixa no celular; sem saber quanto falta até o limite.
- Evidência: `shots/joao-20-b301-preenchida.png`, `joao-30-sem-sinal.png`.
- Sugestão: auto-crescer e mostrar contador "x/500"; ditado por voz ajudaria (mãos sujas).

### Pontos positivos
- Identificação em 1 toque, alvos grandes, fluxo curto (6 toques por atividade).
- Salvamento automático rápido (~2 s) e recuperação de sinal automática com mensagem clara "Sem conexão — tentando de novo".
- Lista de funções do efetivo já vem da programação.
- Quadro público mostra a causa por atividade e atualiza com os lançamentos do campo.
