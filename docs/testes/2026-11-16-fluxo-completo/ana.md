# Teste de campo: Ana Souza (caldeiraria), celular Pixel 7 (412x915)

Specs: `specs/20-ana-1-abrir`, `20-ana-2-dia`, `20-ana-3-quadro`, `20-ana-4-fechar` (+ `util-ana.ts`). Log bruto: `notas/ana-log.jsonl`. Capturas: `shots/ana-*.png`.
Observação de ferramenta: rodar com `--trace off --output resultados/ana`. Com o outputDir compartilhado, o trace dos colegas em paralelo derrubou o 1º spec no `ctx.close()` (ENOENT). É problema do teste, não do app.

## Medidas

| Tarefa | Toques (realistas no celular) | Tempo até "Salvo ✓" | Rolagem |
|---|---|---|---|
| Abrir link até "Quem é você?" | 0 | 2,4 s | nenhuma |
| Escolher "Ana Souza" | 1 | 1,4 s | nenhuma (botões 380x56, ótimos) |
| Lançar 4 caldeireiros | 5 (+ Adicionar, abrir menu, escolher, tocar Qtd, digitar) | 1,65 s | Efetivo fica a 1,46 tela do topo (página tem 2,35 telas) |
| +2 soldadores | 5 | 1,64 s | – |
| Soldador 2 → 3 | 3 (tocar, apagar, digitar) | 1,64 s | rolar até o Efetivo |
| Avanço tubos 3 / 6 / 8 | 3 cada | 1,64 s cada | campo visível após rolar 1x |
| Chapa "✓ Concluída" | 1 (botão 128x48) | 2,2 s | – |
| Horário início | 2 + seletor de hora | 1,65 s | topo |
| Efetivo inicial completo (4C+2S) | cerca de 10 toques + 1,5 tela de rolagem | – | – |

Console: nenhum erro ou pageerror em uso normal. Só apareceu `ERR_INTERNET_DISCONNECTED`, esperado no teste sem sinal. Sem rolagem horizontal (412 = 412).

## Achados

### 1. "Terminou? Avise o planejador." é só um texto, não tem botão (atrapalha)
- Onde: rodapé da tela da Ana (`ana-24-terminou.png`, `ana-23-tudo-apos-lancar.png`).
- O que aconteceu: terminei tudo e não há como avisar pelo app. Contei os botões Enviar/Avisar/Terminei visíveis para a responsável: **0**. Fica parecendo que falta um botão ou que eu teria de ligar. O "Enviar turno" só existe em "Ver tudo".
- Sugestão: botão grande "Terminei minha parte" por responsável, que marque a equipe como concluída no quadro do planejador. Ou, se a ideia for usar o WhatsApp, trocar o texto por "Pronto, seus dados já foram salvos. Avise o planejador por telefone/WhatsApp".

### 2. Mensagem vermelha "Informe a causa…" aparece antes de qualquer lançamento e também durante o dia (atrapalha)
- Onde: cards das atividades com o turno recém-aberto e com 3/8 tubos (`ana-02b`, `ana-20-tubos-3.png`).
- O que aconteceu: às 7 h, sem nada feito, já aparece erro em vermelho nas duas atividades. Com 3 de 8 tubos às 10 h, o app trata a atividade como "não cumprida" e pede causa. Parece que estou errando. Para quem lança aos poucos ao longo do dia, é ruído.
- Sugestão: mostrar a causa só no fim do turno, ou com aviso neutro ("Se não concluir hoje, informe a causa"). Esconder os campos Causa/Observação atrás de "Não vai dar para concluir?". Isso também reduz o card de cerca de 470 px para cerca de 200 px.

### 3. Efetivo começa vazio e fica abaixo das atividades (atrapalha)
- Onde: seção Efetivo (`ana-10-efetivo-vazio`, `ana-12-efetivo-4c-2s.png`).
- O que aconteceu: a equipe prevista (4 Caldeireiro + 2 Soldador, já cadastrada pelo planejador) não vem preenchida. Monto do zero, com cerca de 10 toques. O bloco fica a 1,5 tela do topo, depois dos dois cartões grandes de atividade. O efetivo é a primeira coisa que lanço de manhã.
- Sugestão: pré-preencher com a equipe prevista (só ajustar números) e/ou botão "Usar equipe prevista". Botões − / + ao lado da quantidade, porque com luva é melhor que abrir teclado. Na ordem da tela, colocar Efetivo antes de Atividades ou dar um atalho no topo.

### 4. Horário real e Clima são do turno inteiro, não da minha equipe (atrapalha / risco de interferência)
- Onde: blocos "Horário real" e "Clima" na tela da Ana.
- O que aconteceu: lancei Início 07:00 e esse valor aparece para todos (conferido em "Ver tudo"). Se João lançar 07:30, ele sobrescreve o meu sem aviso. A tela diz "Lançando como Ana Souza", o que faz parecer que é da minha equipe. Não houve sobrescrita durante o teste, mas o desenho permite.
- Sugestão: deixar só para o planejador / "Ver tudo", ou indicar "(vale para o turno todo)", ou guardar por responsável.

### 5. "Ver tudo" e "Trocar" deixam qualquer um editar a equipe dos outros e enviar o turno inteiro (ponto de atenção)
- Onde: `?r=todos` (`ana-40b-ver-tudo-inteira.png`).
- O que aconteceu: em "Ver tudo" há **28 campos editáveis** de todas as equipes e o botão **"Enviar turno"**. Qualquer pessoa com o link envia o turno de todos (eu não toquei). Também dá para "Trocar" para João e lançar como ele, sem confirmação.
- Sugestão: deixar "Ver tudo" só leitura no link de campo, ou pedir confirmação ("Você vai enviar o turno de 4 equipes").

### 6. Fechar o navegador logo depois de digitar perde o dado; recarregar mostra o valor antigo (atrapalha)
- Onde: autosalvar com debounce de 800 ms (`20-ana-4-fechar`).
- O que aconteceu:
  - Digitei 7 e fechei o navegador na hora: **perdeu** (ficou 5).
  - Digitei 5 e recarreguei na hora: a tela voltou mostrando **6, o valor antigo**. O 5 só apareceu num segundo recarregamento, 3 s depois. Quem confere vê o número errado e lança de novo, o que pode gerar conflito.
  - Bloquear a tela (visibilitychange) salvou corretamente (7). Com uso normal (esperar 2 s) nada se perdeu.
  - Nos primeiros 800 ms depois de digitar não aparece nada. Numa edição seguinte, o "Salvo ✓" anterior continua na tela durante esse intervalo, então parece salvo sem estar.
- Sugestão: mostrar "Salvando…" já ao digitar (estado pendente) e apagar o "Salvo ✓" velho. Avaliar `navigator.sendBeacon`/`keepalive` no pagehide.

### 7. Reabrir o link original pergunta "Quem é você?" de novo (detalhe)
- O que aconteceu: a escolha fica só na URL (`?r=`), por regra do projeto. Quem reabre pelo WhatsApp responde de novo (1 toque). Pelo histórico do navegador, com `?r=`, abre direto. Os dados estavam todos lá: 8 tubos, 3 m², 07:00, 4 Caldeireiro + 3 Soldador.
- Sugestão: aceitável. Poderia sugerir "Salve este endereço / adicione à tela inicial" depois da escolha, ou o planejador mandar um link por responsável já com `?r=`.

### 8. Sem sinal: aviso pequeno, mas recupera bem (detalhe)
- Onde: `ana-41-sem-sinal.png`.
- O que aconteceu: "Sem conexão — tentando de novo" aparece em texto pequeno vermelho no fim do bloco, fora da vista de quem está no campo editado. Quando o sinal voltou, salvou em 0,8 s.
- Sugestão: faixa fixa no topo "Sem sinal — seus dados serão enviados quando voltar".

### 9. Textos e formatos (detalhe)
- "Previsto: 8 tubo": falta o plural ("8 tubos").
- Hora aparece "07:00 AM" no seletor (Chromium do teste, apesar de locale pt-BR). Conferir num aparelho real, porque no Brasil o esperado é 24 h.
- O título da obra ocupa 2 linhas grandes no topo. Num link de campo, poderia ser menor para subir o conteúdo.
- Sem indicação de meta da semana/progresso acumulado (24 tubos na semana). Mostra só a meta do dia, o que está OK, mas o encarregado de campo gosta de ver o "faltam 16".
- Botão "✓ Concluída" some depois que conclui. Para desfazer, tem de editar o número, sem botão de desfazer (aceitável).

### 10. Quadro público: meu avanço aparece certo (positivo)
- `ana-50-quadro-publico-cel.png`, `ana-51-quadro-publico-tv.png`: "Ana Souza · 7 pessoas · 70,0 HH · 2 de 2 programadas · 100%", 8/8 tubo e 3/3 m² com barras verdes. Abriu em 1,6 s. Atualiza sozinho (router.refresh periódico).
- Detalhe: na TV, os números "0 de 2 programadas · 0%" quebram em 2 linhas na coluna estreita do nome.

## Interferência entre colegas
Durante o teste não vi meus dados alterados por outros. Efetivo e atividades ficaram como lancei. Riscos estruturais: achados 4 e 5.
Observação: no meu teste de "sem sinal" e de fechar, mexi temporariamente no **meu** efetivo (Caldeireiro 5/6/7) e restaurei para **4 Caldeireiro + 3 Soldador**, conferido após recarregar. Durante esses ~20 s o quadro pode ter mostrado outros números para a Ana.
