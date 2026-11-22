# Teste de campo: Carlos Pereira (elétrica), celular simples e internet ruim

- **Data:** 16/11/2026
- **Ambiente:** servidor local em modo produção, Supabase de desenvolvimento.
- **Aparelho:** emulação do Moto G4 (360×640).
- **Rede lenta:** emulada via CDP, com 400 kbps de download, 200 kbps de upload e 600 ms de latência.
- **Specs:** `specs/22-carlos-{1-abrir,2-atividades,3-offline,4-extra-quadro}.spec.ts`. Usei uma config própria (`carlos.config.ts`, com saída em `resultados-carlos/`).
- **Log bruto:** `notas/carlos-log.jsonl`.
- **Capturas:** `shots/carlos-*.png`.

## Tempos medidos com a rede lenta

| O quê | Tempo |
|---|---|
| Abrir o link até o primeiro byte | 1,0–1,7 s |
| Tela "Quem é você?" visível | 1,0–1,8 s (antes da fonte da marca carregar; já dá para tocar, porque os nomes são links comuns) |
| Página carregada por completo | 6,0–6,7 s (219 KB) |
| Tocar no nome até aparecer a tela do responsável | 1,2–2,0 s |
| "Trocar" até voltar ao "Quem é você?" | 1,4 s |
| Digitar até aparecer "Salvo ✓" (atividade) | ~1,5 s (800 ms de espera do app mais a ida e volta) |
| Digitar até aparecer "Salvo ✓" (efetivo) | ~1,9 s |
| Rede volta (offline de verdade) até "Salvo ✓" | ~6 s |
| Quadro público abrindo | 1,5 s |

**Resultado final no quadro público:** bate com o que lancei. Carlos Pereira aparece com 3 pessoas · 30,0 HH · 2 de 2 programadas · 100%; cabos 70/60 m; megger 5/4 motor. Antes de conferir, precisei corrigir o megger: ver o achado 3.

---

## Achados

### 1. Rede "que finge" (tem sinal mas nada passa): o app desiste e manda recarregar, e recarregar apaga o que eu digitei
- **Onde:** cartão da atividade (cabos).
- **O que aconteceu:**
  - Os envios ao servidor falhavam com conexão resetada, mas o celular continuava achando que tinha rede.
  - Linha do tempo: 1 s "Sem conexão — tentando de novo"; 26 s "Não foi possível salvar. Recarregue a página."
  - Quando a rede voltou de verdade, o app **não tentou de novo sozinho**. A mensagem continuou lá 8 s depois.
  - Fiz o que a tela mandou e recarreguei. O campo voltou para **71** (valor antigo) e **os 70 se perderam** sem aviso.
  - Enquanto isso o selo verde "Concluída" ficou aceso no mesmo cartão, mesmo sem nada salvo.
- **Gravidade:** **bloqueia/perde dado.** No canteiro, sinal de 1 risquinho é o normal.
- **Evidência:** `carlos-27-rede-finge-desistiu.png`, `carlos-28-apos-recarregar.png`, log "linha do tempo com rede que finge".
- **Sugestão:**
  - Não desistir: continuar tentando com intervalo crescente.
  - Tentar de novo também quando a página volta a ficar visível, ou num botão "Tentar de novo".
  - Trocar "Recarregue a página" por "Toque aqui para tentar de novo".
  - Enquanto houver pendência, avisar no topo da tela ("1 lançamento não salvo") e deixar o selo neutro.

### 2. Recarregar (ou o navegador fechar a aba) sem rede perde o que está pendente, sem aviso
- **Onde:** megger. Fiquei sem rede, digitei 6 e apareceu "Sem conexão — tentando de novo". Puxei a tela para atualizar.
- **O que aconteceu:**
  - Apareceu a página de erro do Chrome (sem internet).
  - Com a rede de volta, o servidor tinha 5: **o 6 sumiu**.
  - Nada perguntou "você tem lançamento não salvo, sair mesmo?".
- **Gravidade:** atrapalha (perde dado de forma silenciosa).
- **Evidência:** `carlos-25-megger-6-offline.png`, `carlos-26-reload-offline.png`.
- **Sugestão:**
  - Quando houver salvamento pendente, usar `beforeunload` para o navegador perguntar antes de sair.
  - Como guardar no navegador está vetado pelas regras do projeto, pelo menos avisar com destaque "não feche nem atualize até aparecer Salvo".

### 3. Gravação "fantasma" chegou depois e a tela ficou mostrando outro número
- **Onde:** megger, logo após o achado 2.
- **O que aconteceu:**
  - A página antiga ainda conseguiu reenviar o 6 quando a rede voltou. Isso foi na emulação, em que o reload sem rede não matou a página antiga.
  - O envio chegou **depois** que a página nova já tinha aberto mostrando 5.
  - A tela continuou mostrando **5** enquanto o servidor e o quadro tinham **6**. A tela de campo não se atualiza sozinha.
  - Só descobri ao reabrir: a página abriu com megger = 6. Corrigi para 5.
- **Gravidade:** atrapalha. Número divergente sem ninguém saber.
- **Ressalva:** a reprodução depende de como o Chrome do celular trata a página antiga; vale confirmar num aparelho real.
- **Evidência:** log "estado final … megger: 6" e "megger ao abrir v: 6" (spec 4).
- **Sugestão:**
  - Revalidar a tela de campo ao voltar a rede ou o foco (por exemplo `router.refresh()` em `online`/`visibilitychange`).
  - No servidor, rejeitar uma gravação velha usando versão/carimbo, como o efetivo já faz com o `esperado`.

### 4. "Salvo ✓" continua aparecendo logo depois de eu mudar o número (o valor novo ainda não foi salvo)
- **Onde:** qualquer cartão de atividade.
- **O que aconteceu:**
  - Troquei 40 por 60 e o "Salvo ✓" verde continuou na tela.
  - Só ~0,8 s depois virou "Salvando…". Com rede lenta, a janela enganosa passa de 1 s.
  - Quem lê pouco olha o verde e guarda o celular.
- **Gravidade:** atrapalha.
- **Evidência:** `carlos-12-cabos-tocou-concluida.png` (mostra 60 com "Salvo ✓" no mesmo instante do toque). No log: "Salvo ✓" detectado em 2 ms após a mudança.
- **Sugestão:** limpar o indicador (ou mostrar "Alterado…") no mesmo instante em que o valor muda, sem esperar os 800 ms.

### 5. Não existe botão "Salvar". O único botão do cartão é "✓ Concluída", e tocar nele apaga o meu número
- **Onde:** cartão de cabos.
- **O que aconteceu:**
  - Digitei 40 e procurei onde confirmar. O "OK/Enter" do teclado não faz nada visível.
  - Toquei duas vezes rápido no único botão ao lado, "✓ Concluída", achando que era confirmar.
  - O campo virou **60** (a meta) na hora, o botão sumiu e salvou. Os 40 foram substituídos sem aviso e sem desfazer.
  - O toque duplo não causou duplicidade: o valor é sobrescrito, não somado. Esse é o lado bom.
- **Gravidade:** atrapalha. Lança produção que não aconteceu.
- **Evidência:** `carlos-10-cabos-40-digitado.png`, `carlos-12-cabos-tocou-concluida.png`.
- **Sugestão:**
  - Deixar claro que "salva sozinho". Por exemplo, um texto fixo "Salva automático" perto do campo, ou "Salvo ✓" maior.
  - Se o campo já tem valor diferente da meta, "✓ Concluída" deveria perguntar ("Trocar 40 por 60?") ou oferecer "Desfazer" por alguns segundos.

### 6. "Executado" é o total do dia ou o quanto fiz agora? Não fica claro
- **Onde:** campo "Executado (m)".
- **O que aconteceu:**
  - Lancei 40 de manhã e depois 70. O app **substitui** (fica 70), não soma.
  - Um encarregado que "lança de novo" o trecho da tarde (30) baixaria o total sem perceber.
- **Gravidade:** atrapalha (risco de número errado no PPC).
- **Sugestão:** rótulo "Total executado hoje (m)" ou uma dica "some tudo do dia". Opcionalmente, um botão "+ somar" para lançamentos parciais.

### 7. Serviço extra não programado não tem onde ser lançado pelo campo
- **Onde:** tela do Carlos. Tentei "Troca de iluminação da plataforma 3", 12 luminárias.
- **O que aconteceu:**
  - Na minha tela só existem estes controles: "✕", "+ Adicionar função" e o link "Trocar". Fora isso, os campos de quantidade, efetivo, horário e clima.
  - Não há "+ serviço extra", nem campo de observação geral.
  - As atividades concluídas **escondem** o campo Observação, então nem como nota eu consegui registrar.
  - O único jeito é ligar para o planejador ("Terminou? Avise o planejador.").
  - No quadro, as 3 pessoas aparecem 100% alocadas nas duas atividades; as horas do serviço extra somem.
- **Gravidade:** **bloqueia** o registro, e numa parada isso é comum.
- **Evidência:** `carlos-31-procura-servico-extra.png`, log "controles disponíveis na tela do Carlos".
- **Sugestão:**
  - Botão "+ Serviço não programado": descrição, quantidade, unidade e, opcionalmente, foto.
  - Entra como "extra", fora do PPC, para o planejador aprovar.
  - No mínimo, uma observação geral por responsável que não dependa do status da atividade.

### 8. A página às vezes dá erro 500, e a tela de erro está em inglês
- **Onde:** ao abrir o link do Carlos (`?r=…`) uma vez, durante uso simultâneo dos 4 responsáveis.
- **O que aconteceu:**
  - Apareceu "This page couldn't load. A server error occurred. Reload to try again." e "ERROR 1096880799".
  - No console: "An error occurred in the Server Components render".
  - Uns segundos depois a mesma URL abriu normal (200).
- **Gravidade:** atrapalha. Para o Carlos, a tela em inglês é o mesmo que "o app quebrou".
- **Evidência:** `carlos-30-erro-500-ingles.png`, log `http 500` e `pageerror`.
- **Sugestão:**
  - Criar `error.tsx` em `app/t/[token]` em português: "Não conseguimos abrir agora. Tentar de novo", com botão grande.
  - Investigar a causa do 500 intermitente: pode ser instabilidade do Supabase ou concorrência.

### 9. Aviso vermelho de erro antes de eu fazer qualquer coisa
- **Onde:** os dois cartões, ao abrir no começo do turno (status "Não iniciada").
- **O que aconteceu:**
  - Aparecem "Causa do não cumprimento" e, em vermelho, "Informe a causa para atividades não concluídas".
  - Às 7 h da manhã isso parece bronca/erro. O campo de causa toma meia tela por atividade.
- **Gravidade:** atrapalha (ruído, rolagem longa no celular pequeno).
- **Evidência:** `carlos-04-carlos-topo.png`, `carlos-06-efetivo-30-salvando.png`.
- **Sugestão:** mostrar causa e observação só depois que houver número lançado abaixo da meta, ou perto do fim do turno. Sem vermelho antes disso.

### 10. Nome errado: fácil de entrar, difícil de perceber e o "Trocar" é minúsculo
- **Onde:** toque em "João Lima" por engano.
- **O que aconteceu:**
  - Abre a tela do João já **editável**, com campos e botões "✓ Concluída" das atividades dele.
  - A única pista é a linha pequena "Lançando como **João Lima** · Trocar". O título grande é o nome da obra.
  - O link "Trocar" mede **43×17 px**, bem abaixo dos ~44×44 recomendados para dedo.
  - Voltar levou 1,4 s e funcionou. Não lancei nada no nome do João.
  - Porém um toque descuidado em "✓ Concluída" lançaria produção no nome dele, e nada pede confirmação.
- **Gravidade:** atrapalha.
- **Evidência:** `carlos-03-joao-errado.png`, log "tamanho do link Trocar".
- **Sugestão:**
  - Faixa grande no topo: "Você é JOÃO LIMA? [Não sou eu]", com o nome em destaque.
  - Botão "Trocar" do tamanho de um botão de verdade.
- **Toque duplo no nome certo:** não causou problema, porque o 2º toque já não achou o botão.

### 11. "Ver tudo" deixa qualquer um editar e enviar o turno de todos
- **Onde:** botão "Ver tudo" no "Quem é você?".
- **O que aconteceu:**
  - Aparecem "✓ Concluída" de todas as equipes, "+ Adicionar função" em todas e o botão "Enviar turno".
  - Um encarregado distraído pode marcar a atividade do colega ou enviar o turno.
- **Gravidade:** atrapalha (risco de interferência entre equipes).
- **Evidência:** `carlos-32-ver-tudo.png`, log "botões em Ver tudo".
- **Sugestão:** "Ver tudo" somente leitura, ou pedir confirmação ("Você está editando a equipe de Ana Souza").

### 12. Horário real e Clima são do turno inteiro, mas aparecem editáveis na tela de cada responsável
- **Onde:** topo e rodapé da tela do Carlos.
- **O que aconteceu:**
  - Se eu mudar o "Início" ou o clima, muda para Ana, João e Rita também.
  - Nada na tela diz que é compartilhado. Não alterei, para não interferir.
- **Gravidade:** atrapalha (4 pessoas editando o mesmo campo).
- **Sugestão:** mostrar "(vale para a obra toda)" ou deixar só o planejador/um responsável editar. No link por responsável, somente leitura.

### 13. Digitar errado: tratado, mas com mensagem duplicada e selo confuso
- **Onde:** cabos, digitando "7O" (letra O).
- **O que aconteceu:**
  - "Digite um número válido" aparece **duas vezes** no cartão.
  - O selo volta para "Não iniciada", embora eu já tivesse lançado antes.
  - Ao corrigir para 70 deu "Salvo ✓" em ~1,5 s.
- **Efetivo 30 → 3:** corrigir apagando um dígito funcionou. O 30 chegou a ser enviado (apareceu "Salvando…"), mas o valor final ficou 3, sem linha duplicada (`carlos-06`, `carlos-08`, `carlos-09`). Por ~1 s o quadro pode ter mostrado 30 pessoas. A quantidade não tem limite de bom senso (aceita até 999).
- **Gravidade:** detalhe.
- **Evidência:** `carlos-13-cabos-7O-invalido.png`.
- **Sugestão:**
  - Mostrar a mensagem uma vez só.
  - Manter o selo anterior enquanto o número é inválido.
  - Para efetivo, avisar quando passar muito do previsto ("30 eletricistas? previsto 3").

### 14. Lançar acima da meta passa calado
- **Onde:** cabos 70/60 m e megger 5/4.
- **O que aconteceu:**
  - O selo diz "Concluída" e o quadro mostra a barra cheia e "70 / 60 m".
  - Nenhum destaque de "+10 m acima", nem pergunta se foi erro de digitação. É útil para pegar dedo gordo, por exemplo 600 em vez de 60.
- **Gravidade:** detalhe.
- **Evidência:** `carlos-14-cabos-70-salvo.png`, `carlos-33-quadro-publico.png`.
- **Sugestão:** acima de, digamos, 150% da meta, pedir confirmação. No quadro, um selo "acima da meta".

### 15. Detalhes visuais
- **"Previsto: 4 motor":** sem plural (o mesmo vale para "un", "tubo").
- **Horário em "07:00 AM":** formato 12 h no campo de hora. Vem do navegador/emulação; vale confirmar num celular em pt-BR.
- **Título da obra:** ocupa 2 linhas grandes e empurra o conteúdo; no celular pequeno só o 1º cartão cabe na tela.

## O que funcionou bem
- **Abertura:** a tela "Quem é você?" abre rápido mesmo com rede ruim (~1–2 s), e os botões de nome são grandes.
- **Queda de rede de verdade:** cair a rede no meio de um salvamento com o celular sabendo que está offline mostra "Sem conexão — tentando de novo" e salva sozinho quando volta (~6 s). Não houve duplicação no efetivo: continuou 1 linha "Eletricista 3".
- **Sair logo depois de digitar:** tocar em "Trocar" logo após digitar (45) não perdeu o valor.
- **Quadro público:** confere com o campo; atualiza e é legível na TV.

## Interferências observadas
- **Valores alterados por outros testadores:** as atividades do João já tinham valores (0,1 un, causa Material) e a Rita 45/90 m³.
- **Pasta de resultados compartilhada:** o 1º run quebrou porque outro testador limpou `resultados/` (pasta de artefatos do Playwright compartilhada). Passei a usar `resultados-carlos/`. Isso não afeta o app.
- **Erro 500 intermitente (achado 8):** aconteceu enquanto os 4 usavam o link ao mesmo tempo.

## Estado final deixado
- **Cabos:** 70 m.
- **Megger:** 5 motores.
- **Efetivo do Carlos:** 1 linha, Eletricista 3.
- Horário e clima não foram mexidos. Não fechei o turno nem gerei link.
