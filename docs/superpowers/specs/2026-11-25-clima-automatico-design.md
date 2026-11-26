# Clima automático no RDO — design

Data: 2026-11-25 · Pedido de Luis

## Por quê
Hoje o clima do RDO é lançado à mão pelo responsável em três linhas fixas (Manhã / Tarde / Noite), cada uma com
Bom / Chuva leve / Chuva forte e "Impediu o trabalho". Luis quer um registro **mais profissional e mais detalhado**,
sem ninguém precisar lançar: o app registra a situação do tempo **a cada duas horas, dentro do período do turno**,
e o RDO mostra um resumo em destaque e as leituras embaixo. A linha "Noite" num RDO de turno diurno não faz sentido.

## Objetivos
- O clima de cada turno é **obtido automaticamente** de um serviço meteorológico, para a localização da obra,
  **somente dentro da janela do turno** (diurno ou noturno), com uma leitura a cada 2 horas.
- O bloco de clima do RDO mostra:
  - **em destaque (número grande):** temperatura média do turno; "Choveu" / "Não choveu" e total em mm;
    máxima e mínima do turno;
  - **em letra pequena embaixo:** as leituras de 2 em 2 horas (hora, condição, temperatura, chuva em mm);
  - **linha curta:** "Atividades paradas por clima: N" — *minha decisão:* conta toda atividade do turno com
    causa `clima`, de qualquer tipo e status (parcial ou não iniciada), igual ao que a Análise já agrupa por causa;
    omitida se 0;
  - **fonte:** "Dados: Open-Meteo (modelo meteorológico para a localização da obra)".
- Durante o turno, campo (link do responsável) e página do turno do planejador mostram as leituras **até agora**,
  só leitura.

```
CLIMA                                       Dados: Open-Meteo
  29 °C     Choveu · 4 mm        máx 33° · mín 24°
  média do turno
  07h       09h       11h       13h       15h       17h
  Sol 27°   Sol 30°   Nubl 31°  Chuva 32° Chuva 30° Nubl 28°
  0 mm      0 mm      0 mm      3 mm      1 mm      0 mm
  Atividades paradas por clima: 2
```

## Não objetivos
- Previsão do tempo (o RDO registra o que aconteceu, não o que se esperava).
- Estação meteorológica própria / dados de sensor na obra.
- Alertas de chuva, notificações.
- Fazer IA ou regra decidir se o clima parou a obra.

## Anti-objetivos (seria falha mesmo funcionando)
- Envio ou fechamento do turno **travar** porque o serviço de clima está fora do ar.
- O app voltar a perguntar ao responsável sobre clima (o campo fica mais leve, não mais pesado).

## Decisões de Luis
- Leituras **a cada 2 horas**, dentro do **período do turno**.
- Destaque grande com a **média** e **se choveu**; leituras pequenas embaixo. Cores do print do celular não importam.
- **"Impediu o trabalho" sai.** Quem parou por chuva já marca a atividade como parada com causa **Clima (externa)**.
- Abordagem **A** (abaixo).

## Abordagens consideradas
- **A — Buscar de uma vez no envio/fechamento (escolhida).** Uma consulta ao Open-Meteo (gratuito, sem chave)
  pega os dados hora a hora da janela do turno; o app grava as leituras de 2 em 2h. Durante o turno a tela consulta
  na hora, sem gravar. Sem peça rodando em segundo plano; uma falha pode ser repetida sem deixar buraco; o noturno
  funciona igual.
- **B — Agendador gravando "agora" a cada 2h.** Descartada: o projeto não tem agendador; o da Vercel no plano atual
  roda 1x/dia (exigiria Pro ou pg_cron no Supabase); rodada que falha deixa buraco permanente; roda para obras sem turno.
- **C — O celular do responsável grava ao abrir o app.** Descartada: depende de alguém abrir; buracos.

## Como funciona (decidido)

### 1. Localização da obra
- A obra ganha **cidade com coordenadas**: `obras.local_nome` (ex.: "Macaé, RJ"), `obras.latitude`, `obras.longitude`
  (todos opcionais).
- No cadastro/edição da obra, campo **"Cidade (para o clima)"**: o planejador digita e escolhe numa lista de
  sugestões (API de geocodificação do Open-Meteo, por nome de cidade). O endereço em texto livre continua como está.
  *Minha decisão:* por cidade, não pelo endereço completo — a geocodificação gratuita de endereço é instável e o
  clima não muda dentro da mesma cidade para efeito de RDO.
- **Cidade obrigatória** no cadastro e na edição da obra (decisão de Luis: ainda não há clientes usando o app, então
  não há obras antigas a migrar nem aviso especial para elas).
- Obra sem cidade (só dados de teste antigos): o bloco de clima mostra "Clima automático indisponível — informe a cidade da obra" (com link
  para a obra, na tela do planejador) e o RDO mostra "Clima não registrado (obra sem cidade)".

### 2. Janela do turno
- Início = `hora_inicio_real`, senão `hora_inicio_prevista`; fim = `hora_fim_real`, senão `hora_fim_prevista`.
- Turno noturno cujo fim é menor que o início atravessa a meia-noite: o fim cai no dia seguinte.
- Fuso: o da localização (Open-Meteo `timezone=auto`).
- Leituras: horas cheias a partir do início arredondado para baixo, de 2 em 2h, **sempre incluindo a última hora
  cheia da janela** (ex.: 07:00–17:30 → 07, 09, 11, 13, 15, 17; 07:00–16:00 → 07, 09, 11, 13, 15, 16).
- Média, máxima, mínima e chuva total calculadas com **todas as horas** da janela, não só as amostradas.
- **Nunca além de "agora"** (*minha decisão*): a janela é cortada na hora da gravação, para nunca gravar previsão.
  No envio automático o fim real já é o último Terminei; no envio manual sem fim real, corta-se no momento do envio.
  Por isso o **fechar sempre busca de novo**, mesmo havendo leituras.

### 3. Quando grava
- Ao **enviar** (automático pelo último Terminei, ou manual) e ao **fechar**, **antes** da atualização de status em
  `aplicarAcao`: busca o clima e grava as leituras do turno (substitui as existentes do turno).
  É obrigatório estar gravado antes do fechar porque o retrato do RDO (`foto_rdo`, disparado pelo trigger de status)
  é tirado nesse momento.
- **Falha do serviço não bloqueia:** loga e segue; o RDO sai com "Clima não disponível no momento do fechamento".
  Na página do turno do planejador, turno **enviado** sem leituras: botão **"Buscar clima de novo"**.
  Turno **fechado** sem leituras (*minha decisão*): sem botão; aviso "Clima não registrado — reabra e feche o turno
  para buscar de novo". Assim não se mexe no bloqueio de turno fechado (`tg_bloquear_turno_fechado`) e tela e RDO
  emitido nunca divergem.
- Reabrir + fechar busca de novo (horário real pode ter sido corrigido).

### 4. Dados gravados
- Nova tabela `clima_leituras` (turno_id, hora timestamptz, temperatura numeric, chuva_mm numeric,
  codigo_tempo int — código WMO do Open-Meteo), única por (turno_id, hora). Mesmas regras de RLS das outras tabelas
  do turno; escrita só pelo servidor.
- Resumo (média, máx, mín, chuva total) gravado junto em `turnos` ou em tabela própria — **o builder escolhe**, desde
  que venha de todas as horas da janela e entre no retrato do RDO.
- `foto_rdo` passa a incluir leituras e resumo (nova migração redefine a função, como as anteriores).
- Condição exibida a partir do código WMO, em rótulos curtos em português: Sol, Poucas nuvens, Nublado, Neblina,
  Garoa, Chuva fraca, Chuva, Chuva forte, Tempestade. Sem emoji no PDF (react-pdf não desenha); ícone opcional na
  tela fica a critério do builder.

### 5. O que sai / o que fica
- Saem da tela (campo e planejador): `BlocoClima` editável, ações `salvarClima`/`removerClima`/`corrigirClima`/
  `limparClimaPlanejador`, "Última alteração do clima", e a frase "O clima impediu o trabalho neste turno"
  do Resumo (substituída por "Atividades paradas por clima: N").
- **Sem compatibilidade com o clima manual** (decisão de Luis: ninguém usa o app ainda). A tabela antiga `clima`,
  sua validação e a exibição Manhã/Tarde/Noite saem por completo; `foto_rdo` deixa de incluí-la. Retratos de RDO de
  teste já emitidos que tenham a chave antiga simplesmente não mostram clima. Versões de RDO já emitidas
  não mudam (são retratos).

### 6. Durante o turno (tela)
- Campo e página do turno consultam o Open-Meteo no servidor ao carregar, com cache de ~30 min por obra/janela,
  mostrando as leituras até a hora atual. Falha: o bloco some com "Clima indisponível agora". Não grava nada.

## Restrições
- Sem `localStorage`/`sessionStorage` (regra do projeto).
- Chamadas externas isoladas num módulo (`lib/clima/`), com tempo limite curto (~5 s) e substituíveis por dublê nos
  testes; nenhum teste depende do Open-Meteo real.
- Open-Meteo gratuito é para uso não comercial; para uso comercial o plano pago é barato. **Deixar anotado no
  backlog** a contratação quando houver clientes pagantes (a URL/chave fica em variável de ambiente para trocar sem
  código).

## Inclui
Migração (obra: cidade/coordenadas; `clima_leituras`; resumo; `foto_rdo`; remoção da tabela `clima`), cadastro da
obra com busca de cidade obrigatória,
módulo `lib/clima/`, gravação no enviar/fechar, botão "Buscar clima de novo", bloco novo na tela (campo, turno,
Resumo) e no RDO (PDF), remoção do clima manual, testes (unidade: janela/amostragem/média/noturno/mapeamento WMO;
integração: gravação no enviar/fechar e falha não bloqueante; e2e com dublê), manual (`lib/ajuda/`: campo, fechar
turno, cadastro da obra), capturas, linha em Novidades, item no backlog (plano comercial Open-Meteo), deploy na Vercel.
Fluxograma não muda (a sequência é a mesma; some um passo manual) — o builder confere.

## Fica para o builder
- Onde guardar o resumo (coluna em `turnos` ou tabela).
- Layout exato do bloco na tela e no PDF, respeitando o esboço acima e a identidade visual.
- Tabela de mapeamento WMO → rótulo.
- Mecanismo do cache da consulta ao vivo.
