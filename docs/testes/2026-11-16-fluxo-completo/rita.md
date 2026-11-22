# Rita Alves (andaimes e pintura): teste de campo no celular

Ambiente: link de campo, Pixel 7 emulado em Chromium (o WebKit não está instalado), 16/11/2026, turno diurno em campo.
Specs: `specs/23-rita-1-abrir`, `-2-lancar`, `-3-corrigir`, `-4-duas-abas`, `-5-pintura-quadro`. Log: `notas/rita-log.jsonl`. Capturas: `shots/rita-*.png`.
Estado final deixado: andaime 45/90 m³, causa "Mão de obra", observação "2 montadores emprestados p/ caldeiraria (Ana) à tarde", efetivo da Rita com 6 Montador de andaime. Não fechei o turno, não gerei links e não mexi nas equipes dos outros responsáveis (só olhei o modo "Ver tudo").

## Medidas

| Tarefa | Toques | Tempo |
|---|---|---|
| Abrir o link | 0 | 1,8 s |
| Escolher "Rita Alves" | 1 | 1,4 s |
| Efetivo: 6 montadores (adicionar função, escolher função, tocar na qtd, digitar) | 4 | 2,2 s até "Salvo ✓" |
| Executado 50 | 2 | 1,9 s até "Salvo ✓" |
| Corrigir para 45 | 2 | 1,7–2,3 s até "Salvo ✓" (800 ms de espera antes de salvar + cerca de 0,9 s no servidor) |
| Causa + observação | 3 | cerca de 1,7 s cada salvamento |
| Abrir o quadro público | 0 | 1,6 s |

Console: nenhum erro, nenhum pageerror e nenhuma resposta HTTP ≥ 400 nas 5 rodadas.

## Achados

### R1. Aba antiga sobrescreve sem aviso a quantidade gravada pela outra aba (BLOQUEIA a confiança no número)
- **Onde:** cartão da atividade (Executado, Causa, Observação), com o link aberto em 2 abas (WhatsApp e Chrome).
- **O que aconteceu:** a aba A gravou 46. A aba B, que não foi recarregada e ainda mostrava 45, gravou 47: "Salvo ✓", sem aviso. A aba A continuou mostrando 46 mesmo depois de 15 s e ao voltar a ficar visível; ela não se atualiza sozinha. Em seguida a Rita mexeu **só na observação** da aba A, e o servidor voltou para **46**. A edição de qualquer campo reenvia o conjunto inteiro (quantidade, causa e observação) que estava na tela e desfaz em silêncio o que foi gravado em outro lugar. **Vence a última aba que salvou, inclusive nos campos que ela nem tocou.**
- **Evidência:** log "B salvou 47 sobre o 46 da A", "A após 15 s sem recarregar: 46", "servidor após A editar só a observação: qtdServidor 46" (1ª rodada do spec 4); `shots/rita-20-abaB-47.png`, `shots/rita-21-abaA-depois-15s.png`.
- **Por que importa:** a Rita (e qualquer responsável) abre o mesmo link no WhatsApp e no Chrome. Se o planejador ou o "Ver tudo" corrigirem um número, uma aba esquecida aberta desfaz a correção.
- **Sugestão:** usar no salvamento da execução a mesma checagem otimista do efetivo ("esperado"), ou gravar só o campo que mudou. Recarregar os dados ao voltar para a aba (visibilitychange → router.refresh) quando não houver edição pendente.

### R2. Efetivo detecta o conflito, mas a mensagem confunde e não oferece saída (ATRAPALHA)
- **Onde:** bloco Efetivo › Rita Alves, com 2 abas.
- **O que aconteceu:** a aba A gravou 4 e a aba B (desatualizada) tentou 7, depois 8. Nas duas tentativas apareceu "O efetivo foi alterado por outra pessoa. Recarregue a página.", e o servidor manteve o 4. O dado está protegido, mas a "outra pessoa" era a própria Rita. O campo continua mostrando 7/8, sem botão para recarregar, e recarregar descarta o que ela digitou.
- **Evidência:** `shots/rita-22b-efetivo-conflito-recorte.png`; log "B insiste com 8".
- **Sugestão:** texto como "Este efetivo mudou em outra tela (pode ter sido você em outra aba)". Pôr um botão "Ver valor atual" que recarrega só o bloco e mostra "você tinha digitado 7".
- **Inconsistência:** o efetivo tem proteção contra conflito e a execução (R1) não tem. Para quem está no campo, os dois são "o meu número".

### R3. Não há como registrar os 2 montadores emprestados para a equipe da Ana (ATRAPALHA, dado errado no quadro)
- **Onde:** bloco Efetivo do link de campo.
- **O que aconteceu:** o efetivo é um número por função para o turno inteiro, sem manhã/tarde e sem "emprestado para". Com o link filtrado para a Rita, só aparece a equipe dela. Não existe "+ Adicionar equipe" nem campo de transferência. A única saída foi escrever na Observação do andaime. O quadro mostra **Rita 6 pessoas · 60 HH** e **Ana 7 pessoas · 70 HH**: as 10 HH (2 × 5 h) da tarde ficam contadas na Rita, e a caldeiraria aparece com produtividade melhor do que a real. A observação não aparece no quadro.
- **Alternativa ruim:** no modo "Ver tudo" a Rita conseguiria editar o efetivo da Ana (os blocos de todas as equipes ficam editáveis). Isso resolveria o número, mas mexe no dado de outra responsável sem registro de quem mudou. Não fiz por regra do teste.
- **Evidência:** `shots/rita-04-efetivo-6.png`, `shots/rita-08-ver-tudo.png`, `shots/rita-30-quadro-celular.png`, `shots/rita-31-quadro-tv.png`.
- **Sugestão:** um "Emprestar pessoas" simples (qtd, função, para qual equipe, a partir de que hora) que desconta HH de uma equipe e soma na outra. No mínimo, uma observação por equipe no efetivo que apareça no quadro e no RDO.

### R4. "Salvo ✓" antigo continua na tela enquanto a nova edição ainda não foi salva (ATRAPALHA)
- **Onde:** indicador de salvamento do cartão e do efetivo.
- **O que aconteceu:** depois de corrigir de 50 para 45, o "Salvo ✓" da gravação anterior fica visível por cerca de 800 ms (a espera antes de salvar) até virar "Salvando…". Na 1ª rodada eu me guiei por ele: a captura mostra 45, "Mão de obra", a observação e "Salvo ✓", mas nada daquilo estava gravado ainda.
- **Evidência:** `shots/rita-06-andaime-45-causa.png` e `shots/rita-10-indicador-velho.png`; log "indicador 100ms após digitar 45: Salvo ✓".
- **Sugestão:** ao mudar qualquer campo, trocar logo o indicador para "Alterado…" ou "Salvando…".

### R5. Recarregar logo após digitar mostra o valor antigo, e o novo chega depois (ATRAPALHA)
- **Onde:** qualquer campo, ao recarregar ou sair da página menos de cerca de 1 s depois de digitar (Rita lança tudo de uma vez e fecha rápido).
- **O que aconteceu:** digitei 45, a causa e a observação e recarreguei na hora. A tela voltou com **50, sem causa e sem observação**. Na rodada seguinte o servidor tinha 45 e tudo certo: o salvamento de emergência ao sair (pagehide) chegou **depois** de a página nova ter sido lida. O mesmo aconteceu com a observação "…Y". A Rita vê o dado "sumir", digita de novo, e se digitar algo diferente pode desfazer o que já estava gravado (ver R1).
- **Evidência:** log "aposReload: qtd 50, causa vazia" e, na rodada seguinte, "estadoInicial: qtd 45, mao_de_obra"; "digitar e recarregar após 300ms: perdeu true", com o valor aparecendo gravado depois.
- **Observação:** tocar em "Trocar" (navegação interna) logo após digitar **não** perdeu dado.
- **Sugestão:** avisar ao sair com edição pendente (beforeunload) ou usar navigator.sendBeacon/keepalive. Mostrar "Alterações não salvas" enquanto há algo pendente.

### R6. Adiantar a pintura (Qui/Sex) não é possível pelo link de campo (ATRAPALHA, sem saída no app)
- **Onde:** tela da Rita e "Ver tudo".
- **O que aconteceu:** a pintura não aparece no turno de hoje e não há botão para incluir atividade, puxar uma atividade da semana ou lançar extra. Botões disponíveis na tela da Rita: "✓ Concluída", "✕", "+ Adicionar função". No "Ver tudo" aparece ainda "Enviar turno". O menu Função oferece "Pintor", o que dá a impressão de que ela poderia lançar pintores. Se lançar, as HH vão para o andaime: "Rita 8 pessoas" com só o andaime como produção. O único caminho é ligar para o planejador.
- **Sugestão:** "Puxar atividade da semana" (só as programadas para a semana, marcada como adiantada, com aprovação do planejador). No mínimo, um texto "Quer fazer outra atividade? Avise o planejador" perto da lista de atividades.

### R7. Erro em vermelho antes de qualquer lançamento (DETALHE)
- **Onde:** cartão do andaime ao abrir.
- **O que aconteceu:** com o campo vazio ("Não iniciada") já aparece "Informe a causa para atividades não concluídas" em vermelho. Para quem chega no fim do dia parece bronca antes de começar.
- **Evidência:** `shots/rita-02-tela-rita.png`.
- **Sugestão:** mostrar o aviso só depois de preencher a quantidade ou ao tentar enviar. Em cinza: "Se não concluir, informe a causa".

### R8. Clima e horário real são do turno inteiro, mas aparecem como se fossem da Rita (ATRAPALHA, risco de interferência)
- **Onde:** blocos "Horário real" e "Clima" na tela filtrada da Rita.
- **O que aconteceu:** os blocos não dizem que são compartilhados com Ana, João e Carlos (o código grava por turno). Se a Rita marcar "Chuva leve" de tarde na área dela, muda o clima de todos. Não alterei, para não interferir.
- **Sugestão:** rótulo "do turno, vale para todas as equipes" ou mostrar só ao planejador. Na tela de um responsável, mostrar em modo leitura com "quem preencheu".

### R9. Quadro público: equipe da Rita certa, mas sem o empréstimo e sem observação (DETALHE)
- **O que aconteceu:** o quadro mostra a Rita com 6 pessoas · 60 HH, 45/90 m³ e "Causa: Mão de obra". Não mostra os 2 emprestados nem a observação (R3). As HH são 6 × 10 h mesmo com o horário real vazio. Atividades com 0 executado aparecem com um traço vermelho na barra (Carlos), o que se confunde com progresso pequeno.
- **Evidência:** `shots/rita-30-quadro-celular.png`, `shots/rita-31-quadro-tv.png`.

### R10. "Ver tudo" deixa qualquer pessoa editar as equipes dos outros (ATRAPALHA, governança)
- **O que aconteceu:** o "Ver tudo" é o mesmo formulário editável, para todas as equipes e com "Enviar turno". O nome sugere só leitura. Uma Rita apressada pode digitar no cartão da Ana.
- **Sugestão:** "Ver tudo" só leitura no link de campo, ou chamar de "Lançar por todos (planejador)".

### Infraestrutura do teste (não é do app)
- A 1ª rodada do spec 2 falhou ao fechar o contexto por ENOENT no trace dentro de `resultados/`. Provavelmente outro testador limpou a pasta compartilhada ao mesmo tempo. Usei `trace: "off"` nos specs seguintes.
- Não percebi interferência dos outros responsáveis nos dados da Rita.
