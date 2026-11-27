# Backlog do Frentia

Itens aprovados para fazer. Cada item entra pelo fluxo de sempre (brainstorming → spec → plano → execução).
Origem entre colchetes; notas detalhadas do teste em [docs/testes/2026-11-16-fluxo-completo/](testes/2026-11-16-fluxo-completo/).

Legenda de origem: **P1/P2** planejador (manhã/tarde), **Ana**, **João**, **Carlos**, **Rita** (responsáveis de campo).

---

## Próximo — fila até a primeira IA (decidido em 2026-11-18)

1. Item 8 — "Informe a causa" cedo demais (mesmo card que a IA vai preencher).
2. Item 11 — Clareza do lançamento (o que a IA preenche precisa ter significado claro).
3. Conta de API na Claude Console, chave na Vercel, limite de gasto (fora do código).
4. ✅ **No ar desde 2026-11-22** — IA no campo: texto livre vira registro + IA pergunta o que falta (planilha 10.1 e 10.2). "Conte como foi o dia" no link de campo; tabela relatos_campo.
5. ✅ **No ar desde 2026-11-23** (merge 303947f) — Planejador vê registros incompletos (10.4): bloco "O que falta" no turno + "Cobrar no WhatsApp".
6. ⏸ Lembrete no momento certo (10.3) — **adiado em 2026-11-23**; fica para o futuro (precisa de canal de envio: notificação no celular ou WhatsApp pago).

Depois: demais itens do teste (9, 10, 12–20), cobrança e o resto do épico 10. A IA sai sem custo para o piloto,
com limite de gasto, e vira recurso do plano pago quando a cobrança existir.

## Feito fora da ordem

20. ✅ **No ar desde 2026-11-18** (merge a237be7) — **Manual do usuário dentro do app** — pedido em 2026-11-17 para ser o próximo (antes do item 8). Aba "Ajuda" no
    menu lateral com o manual do planejador, organizado por tarefa ("Programar a semana", "Fazer o check-in",
    "Registrar uma parada", "Fechar o turno e gerar o RDO"…), e um "Como usar" curto no link de campo (o responsável
    não tem menu nem login). Texto versionado junto com o código, para cada funcionalidade nova atualizar o manual
    no mesmo PR; seção "Novidades" no topo. A detalhar no brainstorming: botão "?" em cada tela levando à seção
    certa; capturas de tela geradas pelo teste automático (não envelhecem); busca. [Luis]

1.6 ✅ **No ar desde 2026-11-24** (merge b45f242) — **Atividade não concluída volta para a programação seguinte** (item 1.6 da
    planilha). No rascunho, bloco "Não concluídas da semana anterior" com "Trazer" (meta = saldo; sequência = um item);
    "Saldo da semana anterior mudou" + "Atualizar meta" (também na semana programada, enquanto a atividade não entrou
    em turno). Spec/plano: docs/superpowers/{specs,plans}/2026-11-24-trazer-saldo-semana-anterior*. [Luis]

## Prioridade 1 — Confiança no dado

1. ✅ **Feito em 2026-11-16** — **Conflito entre abas na execução** — uma aba esquecida desfaz em silêncio o número gravado pela outra
   (o efetivo já detecta conflito; a execução não). Detectar versão, avisar e oferecer recarregar.
   A mensagem de conflito do efetivo fala "outra pessoa" mesmo sendo a própria — ajustar e dar botão de recarregar. [Rita]
2. ✅ **Feito em 2026-11-16** — **Sinal fraco de canteiro** — após ~26 s o app desiste ("Recarregue a página"), não tenta de novo quando a rede
   volta, e recarregar apaga o digitado; selo "Concluída" fica verde sem salvar; gravação atrasada chegou depois e
   deixou tela 5 × banco 6. Fila de reenvio, estado "não salvo" visível, nunca mostrar sucesso antes da confirmação.
   (Confirmar em celular real.) [Carlos]
3. ✅ **Feito em 2026-11-16** — **"Salvo ✓" enganoso** — o selo antigo fica ~1 s após nova edição; fechar o navegador nesse intervalo perde o valor;
   recarregar logo depois mostra o valor antigo. Trocar para "Salvando…" na hora da edição e salvar ao sair da página. [Ana, João, Rita, Carlos]
4. ✅ **Feito em 2026-11-16** — **Efetivo e HH corretos** — empréstimo entre equipes conta em dobro (19 no RDO, eram 17); HH = pessoas × horas sem
   descontar almoço; pessoa parada (via "Outra função…") vira HH produtivo. Permitir registrar empréstimo/meio período
   e "parado"; descontar intervalo. [Rita, João, P2]
5. ✅ **Feito em 2026-11-16** — **Links de campo e da TV** — aparecem uma vez e somem ao recarregar; gerar outro derruba o já enviado sem aviso.
   Mostrar o link ativo de novo (ou explicar) e confirmar antes de gerar um novo. [P1]

## Prioridade 2 — Aviso de parada e campo

6. ✅ **Feito em 2026-11-17** — **Aviso de parada / avisar o planejador agora** (item 3 do roadmap) — hoje só existe o texto
   "Terminou? Avise o planejador." sem botão. Incluir: causa pronta em linguagem simples (ex.: "aguardando outra
   equipe" em vez de "predecessora", dizendo qual equipe), horário de início/fim, gente parada, foto, aviso que chega
   ao planejador; causa externa distinguível de interna. [João, Ana, P2]
7. ✅ **Feito em 2026-11-17** — **Serviço extra e adiantar atividade pelo campo** — o responsável não consegue lançar extra nem puxar atividade de
   outro dia da semana. No planejador, o extra só entra como "atividade planejada" escondida em "Editar planejamento",
   sem responsável, executado ou marca de extra. Criar "+ Serviço extra (fora da programação)" nos dois lados.
   Em atividade concluída a Observação some — mantê-la. [Carlos, Rita, P2]
8. ✅ **No ar desde 2026-11-22** (merge 36e777e) — **"Informe a causa" em vermelho cedo demais** — aparece às 7 h e com avanço parcial, antes de qualquer problema.
   Mostrar só no fim do dia/fechamento, em tom neutro, e enxugar o card. [P1, Ana, João, Carlos, Rita]
9. ✅ **No ar desde 2026-11-23** (merge dfbbef2) — **Efetivo pré-preenchido** — começa vazio e fica a ~1,5 tela do topo. Vir com a equipe prevista da programação,
   botões +/− para luva, mais acima na tela. A equipe prevista também deve aparecer no turno e no quadro. [Ana, P1]
   **Decidido em 2026-11-17 (caminho B):** o "Adicionar atividade" do turno ganha **Responsável** (obrigatório, já
   vem com quem está lançando; o planejador pode trocar) e **Equipe** (função + quantidade, opcional, igual à
   programação). O efetivo de cada responsável **começa preenchido** com a soma das equipes das atividades dele
   (programadas e avulsas), mas continua sendo um número próprio e ajustável: a mesma pessoa às vezes trabalha em
   mais de uma atividade no turno, e somar sem ajuste contaria em dobro. O efetivo real segue como base do HH, das
   ocorrências (empréstimo/saída/parado) e do RDO. Atividade sem equipe não soma nada. Depois (opcional): aviso sem
   bloqueio quando a equipe real ficar menor que a soma das atividades. [Luis]

## Prioridade 3 — Números e quadro

13. ✅ **No ar desde 2026-11-25** — **Números que não batem entre telas** — mesmo dia: 63% no turno/RDO, 100% no quadro, 0% na semana/Análise.
    O cálculo está certo (PPC semanal só conta atividade 100% cumprida na semana), falta rótulo: "Cumprimento do dia"
    × "PPC da semana" com explicação (ⓘ), avanço físico ao lado; o extra não deve entrar no denominador do turno/RDO
    (como no quadro). Atividade a 50% aparecer "0%" precisa de explicação. [P2]
14. ✅ **No ar desde 2026-11-25** (exceto a dependência entre equipes, que virou o item 23) — **Quadro e TV** — abre em CHECK-OUT de manhã com 0% e barras vermelhas; causas externas e internas iguais;
    observações não aparecem; ordem alfabética (quem precisa de ajuda fica para trás); produção acima da meta não se
    destaca; fonte da causa ~14 px ilegível a 3 m; sem hora da última atualização; traço vermelho em atividade com 0.
    Dependência entre equipes não aparece (João esperando Carlos). [P1, P2, João, Rita]
    Empréstimo de efetivo: o quadro mostra só o acréscimo na equipe que recebeu ("+2 Mecânico (de Fernando,
    08:00–17:00)"); a equipe que cedeu não mostra o débito. O HH já desconta certo (conferido em 2026-11-17:
    Fernando 21,0 + Francisco 49,0 = 70 HH = 10 pessoas × 7 h, sem contar em dobro) — falta só exibir
    "−2 Mecânico (para Francisco, 08:00–17:00)" no card de quem cedeu (no cálculo, guardar também os "cedidos" por
    equipe, além dos "recebidos"). Conferir se o RDO e o resumo do turno mostram os dois lados. [Luis]

## Prioridade 4 — Demais

10. ✅ **No ar desde 2026-11-23** (merge 9f2dbb8) — **Dados do turno compartilhados e permissões no campo** — horário real e clima valem para o turno inteiro, mas
    aparecem editáveis para cada responsável (um sobrescreve o outro; início veio "07:00" sem preencher).
    "Ver tudo" deixa editar as atividades e o efetivo de todos e "Enviar turno"; "Trocar" lança como outra pessoa sem
    confirmação; tela do nome errado já abre editável; não há histórico de quem alterou. [Ana, João, Carlos, Rita]
    **Correção (2026-11-24, pedido do Luis):** horário volta ao responsável com o botão **"Iniciar turno"** por equipe (hora do toque); início real = primeiro Iniciar, fim real = último Terminei (só quando todas as equipes terminam). Clima volta a ser lançado no campo, com "última alteração" para o planejador.
11. ✅ **No ar desde 2026-11-22** (merge e3417a0) — **Clareza do lançamento** — "✓ Concluída" troca o parcial pela meta; "Executado" substitui, não soma; não há botão
    Salvar explícito. Deixar claro na tela. [Carlos]
12. ✅ **No ar desde 2026-11-23** — **Detalhes do campo** — "Trocar" com 43×17 px; plurais ("8 tubo", "2 Soldador"); meta fracionada "0,5 un"
    (meta da semana dividida pelos dias — rever para itens unitários); tela de erro 500 em inglês e sem "tentar de
    novo" (houve 1 falha momentânea servidor→Supabase); validação do navegador em inglês ("Please fill out this
    field."); texto de ajuda usa "encarregado" (trocar por "responsável" — inclui o subtítulo da tela Responsáveis da obra:
    "Quem assume as atividades no turno: encarregado, líder, supervisor…"); aviso de sem sinal pequeno; reabrir o link
    pergunta "Quem é você?" de novo; hora "07:00 AM" (conferir em aparelho real). [Ana, Carlos, P1, P2]
15. **Programação mais rápida** — NO AR 2026-11-23. ~85 cliques/campos para 8 atividades: manter campos entre inclusões e "duplicar";
    confirmar antes de "Programar semana" (trava a semana); obra nova deveria apontar para a Programação, não
    "Novo turno"; botão em destaque é "Programar próxima semana" em vez da atual; responsável sem campo de
    especialidade; ícone ☀ parece asterisco. [P1]
16. ✅ **No ar desde 2026-11-26** — **Página do turno** — "Fechar turno" no cabeçalho com as pendências no topo; abre com paradas, O que falta e resumo; Corrigir execução, RDO, link (depois que a 1ª equipe inicia) e histórico recolhidos; "Remover" discreto. Spec/plano: docs/superpowers/{specs,plans}/2026-11-26-pagina-do-turno*. Era: ~5.500–6.250 px, "Fechar turno" no fim; "Confirmar fechamento" clicável com pendências
    (deveria levar direto a cada pendência); botão vermelho "Remover" em cada atividade. [P1, P2]
17. ✅ **No ar desde 2026-11-26** — **RDO** — separar trabalho e efetivo por responsável; marcar o serviço extra; alargar a coluna de observações. [P2]
18. ✅ **No ar desde 2026-11-25** — **Análise** — começa 7 semanas antes da obra existir (começar na 1ª semana da obra); selo "provisório" também no
    cartão principal; causas sem separar externas/internas. [P2]

19. ✅ **Feito em 2026-11-24** — **Vincular atividades em sequência (débito do dia passa para a noite)** — ex.: "Montagem de Andaime" 12 m
    Seg diurno (Luis) + 12 m Seg noturno (Alberto) são o mesmo andaime. Opção de vincular ("Continua de…") para o
    saldo seguir: faltou 4 m no dia → noite com meta 16 m; sobrou 3 m → noite com 9 m. Decidido em 2026-11-17:
    - Atividades vinculadas formam **uma sequência na ordem dos turnos** (Seg D, Seg N, Ter D, Ter N…). Meta de
      cada turno = meta própria + débito (ou − sobra) do turno anterior da sequência; o último turno fica com todo
      o saldo. Cobre dia → noite, noite → dia seguinte e tarefa da semana toda nos dois turnos, sem cobrar o
      mesmo débito duas vezes.
    - O turno que não cumpriu continua "não cumprido" e pede causa; o seguinte é medido pela meta herdada.
    - Vínculo **opcional**: atividade sem vínculo segue a regra de hoje (meta ÷ dias, último dia = saldo).
      Só dentro da mesma semana.
    - Fluxo: botão **"Continuar no próximo turno"** no card. Atividade de um dia → cria a do próximo turno já
      vinculada e preenchida (troca só responsável/equipe; dá para encadear). Atividade de vários dias → cria a
      do outro período nos mesmos dias, vinculada. Na lista, a sequência aparece agrupada com a meta total
      (ex.: "Andaime Aciaria · 120 ml — Diurno Seg–Sex 60 · Luis / Noturno Seg–Sex 60 · Alberto").
    - Campo/quadro mostram a origem: "Meta 16 m · inclui 4 m do turno do dia (Luis)". Recalcula quando o
      turno anterior lança execução, até o próximo começar a lançar.
    [Luis/P1]

21. ✅ **No ar desde 2026-11-26** — **HH pela janela de cada equipe** — hoje o HH usa a janela do turno (primeiro Iniciar → último Terminei). Com o "Iniciar turno" por equipe já gravado, dá para contar o HH de cada equipe do seu início ao seu fim. [Luis, 2026-11-24]

22. ✅ **No ar desde 2026-11-25** — **Quadro só exibe problemas e oportunidades** — hoje (item 2.5) o cadastro, "Resolvido", "Reabrir" e "Apagar"
    ficam na página do quadro do planejador. A ideia: o quadro serve só de exibição (como na TV) e o planejador
    controla e edita tudo pela aba Turno. Atualizar manual, capturas e Novidades. [Luis, 2026-11-24]

23. ✅ **No ar desde 2026-11-26** — **Dependência entre equipes no quadro** — mostrar quando uma equipe espera outra (João esperando Carlos). A parada já guarda "aguardando responsável"; falta exibir no quadro e talvez ligar atividade a atividade. Saiu do item 14. [P1, 2026-11-25]

24. **Clima automático no RDO** — Open-Meteo pela cidade da obra; leituras de 2 em 2h, média/máx/mín e chuva gravadas no enviar/fechar; clima manual removido. Spec/plano: docs/superpowers/{specs,plans}/2026-11-25-clima-automatico*. [Luis, 2026-11-25]

25. **Contratar plano comercial do Open-Meteo quando houver clientes pagantes** — o gratuito é só para uso não comercial; trocar `OPEN_METEO_URL` (e chave) na Vercel. [P1, 2026-11-25]

---

### Pendências menores já anotadas antes (para não perder)
Ver memória do projeto/roadmap: proteção de semanas contra escrita direta via API; corrida programar×salvar;
FormEncerrar/FormReabrir perdem dados após erro; "(inativo)" faltando em Quem é você?/cabeçalhos; "Sem turno hoje"
pode mostrar turno futuro; "1 pts" → "1 pt"; delete via API apaga versões do RDO em cascata.
Do item 20 (manual): a explicação do LPS ficou de fora "por hora" — retomar quando fizer sentido.

## Cobrança — marca da empresa no RDO

7.5. **Nome da empresa no RDO + "Minha empresa"** (plano gratuito) — nome centralizado no cabeçalho do PDF, entre o logo do Frentia e "RDO · obra · data"; página "Minha empresa" para corrigir o nome. Spec: docs/superpowers/specs/2026-11-26-nome-empresa-rdo-design.md. [Luis, 2026-11-26] **NO AR 2026-11-27** (merge 3278830, sem migration).
7.6. **Logo da empresa no lugar do Frentia** (plano pago mais barato, depende da cobrança) — envio do logo em "Minha empresa", limite de tamanho e redução automática (teto de 4,5 MB do PDF do mês). [Luis, 2026-11-26]

## Futuro — IA embutida (plano pago)

Conversado em 2026-11-18; detalhes na planilha "Backlog Frentia" (épico 10, itens 10.1–10.10, e G.5).
Fila definida em "Próximo" acima. IA chamada pelo servidor, custo dentro do plano pago (não "conecte sua
conta de IA"). Regra: a IA nunca inventa dado — só organiza e redige o que foi registrado.

- **Bloco 1 — Campo completo (primeiro):** falar ou escrever solto vira registro; IA pergunta o que falta;
  lembrete no momento certo; planejador vê registros incompletos.
- **Bloco 2 — Planejamento:** importar cronograma do Project (XML/Excel); lookahead com restrições prováveis;
  pré-programação da semana (planejador confirma); sugestões pelo histórico de PPC.
- **Bloco 3 — Dono:** IA redige o Relatório da Obra (semana/mês/final, texto imparcial; depende do 4.4); resumo
  semanal. Data book completo na geladeira. Não usar "pleito" no app.
