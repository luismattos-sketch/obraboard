# Teste de usabilidade: planejador, fase 2 (tarde de 16/11/2026)

Persona: o mesmo planejador da fase 1, agora acompanhando o dia, registrando o serviço extra, fechando o turno e conferindo o RDO, a semana e a Análise.

- Specs: `specs/30-planejador-1-acompanhar.spec.ts` e `specs/30-planejador-2-fechar.spec.ts`
- Config: `planejador.config.ts` (outputDir `./resultados-planejador`)
- Textos capturados das telas: `notas/f2-*.txt`
- PDFs: `notas/rdo-v1.pdf` e `notas/rdo-v2.pdf`
- Capturas: `shots/planejador-5x..7x-*.png`

## Resultado geral
Consegui fazer tudo: acompanhar o dia, lançar o extra do Carlos, fechar o turno, baixar o RDO, conferir semana e Análise, reabrir e fechar de novo.

Houve **um bloqueio no fechamento**. O primeiro "Confirmar fechamento" foi recusado com "Há atividades sem causa informada". Isso aconteceu porque o extra entra no turno como atividade planejada sem execução. Contornei lançando "Executado 12" no cartão do extra.

Não houve erro de console. Os `ERR_ABORTED` em `/api/rdo/versao/...` são só o download do arquivo.

## Tempos
| Ação | Tempo |
|---|---|
| Abrir quadro do planejador | **4,6 s** (a mais lenta do dia) |
| Abrir TV (link público) | 1,8 s |
| Abrir turno | 3,5 s |
| Adicionar atividade extra | 2,7 s |
| Atribuir o extra ao Carlos | 1,5 s |
| Lançar a execução do extra (salva sozinha) | ≈ 2,5 s |
| Fechar turno | 2,5 s |
| Baixar RDO v1 | 1,5 s · 27 KB · 2 páginas |
| Lista de RDOs da obra / de todas as obras | 2,0 / 1,4 s |
| Semana | 2,1 s |
| Análise | 2,6 s |
| Reabrir turno (com motivo) | 2,5 s |
| Fechar de novo | 2,5 s |
| Baixar RDO v2 | 1,2 s · 27 KB |

Cliques para fechar o dia: abrir o turno → descer cerca de 5.500 px → "Fechar turno" → "Confirmar fechamento" → (bloqueio) → subir até o cartão do extra → lançar → descer → fechar → confirmar. São uns 8 cliques e muita rolagem.

---

## Achados

### B1. O extra entra como atividade "planejada" e trava o fechamento — **bloqueia (contornável)**
- **Onde:** página do turno, em "Editar planejamento" → "Adicionar atividade", e depois no "Fechar turno".
- **O que aconteceu:**
  - O único caminho para registrar o serviço extra (12 luminárias da plataforma 3) é o formulário "Adicionar atividade". Ele fica dentro do bloco recolhido "Editar planejamento", abaixo de "Baixar prévia".
  - O formulário não tem campo de responsável. É preciso adicionar e depois escolher "Carlos Pereira" no menu do item novo.
  - O formulário não tem campo "executado" nem marca de extra. A atividade nasce como "Não iniciada · 12 un planejado".
  - Ao fechar, aparece "Falta informar a causa em: Instalação de luminárias…". O botão "Confirmar fechamento" continua clicável, e só depois do clique aparece "Há atividades sem causa informada", sem link para o item.
  - Para resolver, o planejador precisa achar o cartão do extra no meio de "Corrigir execução" e digitar 12.
- **Evidência:**
  - `resultados-planejador/.../test-failed-1.png` (1ª tentativa) e `shots/planejador-63b-f2-confirmar-fechamento-visivel.png`
  - `notas/f2-turno-com-extra.txt`: "12 un — Não iniciada" e "Cumprimento 50% — 4 de 8"
- **Sugestão:**
  - Criar um botão "+ Serviço extra (fora da programação)" com os campos responsável e quantidade executada, já marcado como extra.
  - Liberar esse lançamento também no link de campo. Hoje o Carlos não conseguiu, e a Rita também não conseguiu adiantar a pintura de quinta.
  - Desabilitar "Confirmar fechamento" enquanto houver pendências, com link direto para cada uma.

### B2. Turno, RDO, semana e Análise mostram números que não batem entre si — **atrapalha**
| Tela | Número exibido |
|---|---|
| Turno / RDO | "Cumprimento 63% — 5 de 8" (conta o extra) |
| Quadro | Carlos "2 de 2 programadas · 100% +1 extra" (o extra fica fora da conta) |
| Semana | "PPC 0% — 0 de 8 · +1 fora da programação" |
| Análise | "PPC do período 0%", "Semana atual 0%" |

- **O que confunde:** são métricas diferentes (cumprimento diário contra PPC semanal binário), mas os rótulos não explicam isso. O mesmo dia aparece como 63% numa tela e 0% em outra. O extra entra no denominador do turno e do RDO, mas não no do quadro nem no da semana. A Rita fez 45 de 90 m³ e no quadro aparece como "0%".
- **Evidência:** `notas/f2-turno-fechado-v2.txt`, `f2-quadro-apos-fechar.txt`, `f2-semana.txt`, `f2-analise.txt`, `rdo-v2.pdf`.
- **Sugestão:**
  - Tirar o extra do cumprimento do turno e do RDO, mostrando "+1 extra" como no quadro.
  - Chamar o número do dia de "Cumprimento do dia (programadas de hoje)" e explicar, com um "i", que o PPC semanal só conta atividades 100% concluídas na semana.
  - Mostrar o avanço físico (%) ao lado do PPC.

### B3. O efetivo é contado em dobro quando há empréstimo entre equipes — **atrapalha (dado errado no RDO)**
- **Onde:** quadro (Ana com 7 pessoas, Rita com 6), resumo do turno e RDO ("Efetivo total 19", "HH 190").
- **O que aconteceu:** 2 montadores da Rita foram para a caldeiraria à tarde. Eles aparecem nas duas equipes, mas o campo real tem 17 pessoas, não 19. Nada na tela indica isso. A única pista é a observação da Rita, que só aparece no textarea de "Corrigir execução" e no PDF, e não no quadro. O planejador só percebe se ler as observações uma por uma.
- **Sugestão:**
  - Permitir registrar o empréstimo ("2 montadores → Ana, a partir das 13h") ou meio período por pessoa.
  - Alertar quando a soma do efetivo passar do efetivo previsto do dia ou do total do dia anterior.
  - No mínimo, mostrar as observações no quadro, com um ícone de balão por atividade.

### B4. HH superestimado: inclui a gente parada e o almoço — **atrapalha**
- **Onde:** resumo do turno e RDO, "Homens-hora 190 — Horário real".
- **O que aconteceu:**
  - HH = 19 pessoas × 10 h (07–17), sem descontar intervalo.
  - "Mecânico parado aguardando peça", que o João lançou como "Outra função…", vira uma função inventada que soma HH como se fosse produtivo. O quadro mostra "João 3 pessoas · 30 HH" e não dá para ver ninguém parado.
  - As 2 grafias criam uma "função" nova no histórico e poluem as sugestões futuras.
- **Sugestão:**
  - Configurar o intervalo de refeição por obra.
  - Criar o campo "Horas paradas / ociosas" por equipe, com causa, para virar HH improdutivo no RDO e na Análise.
  - Não aceitar texto livre de "parado" como função.

### B5. Quadro: dá para ver quem parou, mas não por quê, nem se a culpa é externa — **atrapalha**
- **Onde:** quadro do planejador e TV (`shots/planejador-51-f2-quadro-checkin.png`, `planejador-52-f2-tv.png`).
- **O que funciona:** a cor das barras (verde concluída, laranja parcial, vermelho não iniciada) e o "Causa: Material" sob a atividade. Em poucos segundos dá para ver que João e Rita não cumpriram.
- **O que falta:**
  - **Distinguir causa externa de interna.** "Material", "Atividade predecessora" e "Mão de obra" aparecem todas no mesmo vermelho pequeno. O João escreveu "Atraso não é da equipe de mecânica", mas isso só está na observação.
  - **As observações não aparecem no quadro:** rolamento 6312, RM 4471, previsão 14:00.
  - **A dependência entre equipes não aparece.** O VTI-02 do João depende da elétrica do Carlos. O Carlos aparece 100% verde, e nada liga o atraso do João à equipe dele.
  - **A ordem é alfabética.** Quem está com problema (João) fica em 3º. A TV não tem destaque de "precisa de ajuda".
  - **A produção acima da meta não aparece.** Carlos fez 70/60 m e 5/4 motores, e a barra é só verde cheia.
  - O texto de causa (~14 px) é ilegível numa TV a 3 m.
- **Sugestão:**
  - Usar ícone ou etiqueta "externa" para causas fora da equipe (material, predecessora, liberação de área, clima) e cor própria para cada grupo.
  - Mostrar a observação resumida e o horário da última atualização.
  - Ordenar a TV com os problemas primeiro.
  - Para a causa "Atividade predecessora", permitir apontar de qual atividade ou equipe se depende.

### B6. Valores fracionados por causa da meta dividida — **atrapalha** (continuação do A2 da fase 1)
- O João, com meta "0,5 un" para a bomba, lançou "0,1 un". O quadro mostra "0,1 / 0,5 un" e a semana mostra "realizado 0,1 un · saldo 0,9 un". Para a revisão de uma bomba, esses números não significam nada.
- **Sugestão:** usar "% de avanço" para atividades de 1 unidade e não fracionar metas inteiras pequenas.

### B7. O RDO conta a história, mas falta quem fez o quê e o extra não é identificado — **atrapalha**
- **Onde:** `notas/rdo-v2.pdf` (27 KB, 2 páginas, gerado em ~1,3 s).
- **O que está bom:**
  - cabeçalho completo, com cliente, endereço e horários previsto e real;
  - causas com as observações completas;
  - "Restrições por causa" agrupadas;
  - a versão 2 traz o motivo da correção e a referência à v1.
- **O que falta ou está errado:**
  - Não há agrupamento por responsável nem efetivo por equipe. O RDO lista "Caldeireiro 4, Soldador 3…" soltos.
  - O extra não está marcado como fora da programação; só dá para saber porque eu escrevi "(extra)" no nome.
  - A coluna "Causa / obs." é estreita demais. A observação do João ocupa cerca de 25 linhas de 2–3 palavras e empurra a tabela para a 2ª página.
  - O "Mecânico parado aguardando peça" aparece como função de efetivo.
  - HH 190 e efetivo 19 estão inflados (B3, B4).
  - Clima fica "—" e nada pede para preencher. Num RDO para o cliente, deveria ao menos avisar no fechamento.
- **Sugestão:**
  - Organizar o RDO em seções por responsável/equipe, com o efetivo da equipe.
  - Criar uma seção "Serviços extras".
  - Pôr as observações numa linha inteira abaixo da atividade, em vez de uma coluna estreita.
  - Avisar "Clima não informado" antes de fechar.

### B8. A página do turno é longa demais para revisar e fechar — **atrapalha**
- A página tem cerca de 5.500 px (`shots/planejador-53-f2-turno.png`).
- O "Fechar turno" fica no fim, depois do efetivo e de três blocos de clima.
- A revisão (resumo) fica no topo e a correção (inputs) no meio. São duas versões da mesma informação, e é fácil se perder.
- **Sugestão:** criar um modo "Revisar e fechar" com uma lista única de pendências, cada uma com link para o campo, e o botão fixo no rodapé.

### B9. Reabrir turno funciona bem — **ok / detalhe**
- O motivo é obrigatório (validação nativa do navegador; aqui apareceu "Please fill out this field." em inglês, por causa do idioma do navegador de teste). Reabrir e fechar de novo levaram 2,5 s cada.
- A v2 do RDO cita "substitui a versão 1… Motivo da correção: …", e o turno mostra "Versões anteriores: v1 (16/11 às 15:46)". Isso é muito bom para auditoria.
- **Detalhe:** em "Corrigir execução" não encontrei um jeito simples de corrigir o empréstimo dos montadores (B3). Por isso reabri, mas fechei com os mesmos números, e o motivo registrado ("Conferir efetivo da Rita…") ficou sem correção real.
- **Sugestão:** usar mensagem de validação própria em português, como "Informe o motivo da reabertura".

### B10. Análise (PPC) — **detalhe**
- Em obra nova, a Análise mostra 7 semanas anteriores à criação da obra (28/09 a 09/11) com barras vazias e "—". Isso é ruído e dá a impressão de dado faltando.
- "PPC do período 0% — 0 de 8" na segunda-feira, com a semana ainda aberta, é desanimador. O selo "provisório" aparece só na barra da semana, não no cartão principal.
- As causas aparecem bem (Material, Predecessora e Mão de obra, 33% cada), mas também sem separar externas de internas.
- **Sugestão:** começar o gráfico na primeira semana da obra e marcar "provisório" também no cartão do topo.

### B11. Lista de RDOs — **ok**
- `/obras/[id]/rdos` mostra "16/11/2026 · Diurno · 63% · v1 · Baixar" (capturado antes da reabertura). É simples e rápida.
- O 63% repete a métrica que confunde (B2).

## O que funcionou bem
- No quadro, as cores das barras e a causa embaixo de cada atividade permitem ver em segundos quem não cumpriu.
- O quadro marca o extra como "EXTRA" e "+1 extra" na equipe do Carlos.
- O planejado × realizado no turno é claro, com os selos Concluída, Parcial e Não iniciada.
- A semana já acumula o realizado do dia ("realizado 8 tubo · saldo 16") e lista o extra em "Fora da programação".
- O PDF é leve (27 KB), rápido (≈ 1,3 s), tem nome de arquivo bom (`RDO-parada-geral-caldeira-3-usina-exemplo-2026-11-16-diurno-v2.pdf`) e o versionamento traz o motivo.
