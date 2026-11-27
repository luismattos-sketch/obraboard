import type { Capitulo } from "../tipos";

export const quadroTv: Capitulo = {
  slug: "quadro-tv",
  titulo: "Quadro na TV",
  resumo: "O quadro do turno abre só pelo link, sem login: na TV do canteiro, no celular do gestor ou no seu computador.",
  noIndice: false,
  passos: [
    {
      id: "link",
      titulo: "Abra o quadro na TV",
      texto: [
        "Na página da obra, em \"Link do quadro (TV / gestor)\", use \"Copiar\" e abra o link no navegador da TV ou do computador ligado a ela. Não precisa de login. O botão \"Quadro\" da obra e o \"Ver quadro\" do turno abrem esse mesmo link: existe um quadro só.",
        "O quadro mostra sozinho o turno de hoje (diurno, ou noturno quando o diurno já fechou) e se atualiza a cada 30 segundos. As setas mostram o turno anterior e o seguinte; \"Agora\" volta para o turno atual.",
      ],
      captura: {
        alt: "Quadro público na tela da TV com o cabeçalho da obra e as faixas por responsável",
        alvo: { papel: "link", nome: "Agora" },
        dispositivo: "computador",
      },
    },
    {
      id: "visoes",
      titulo: "Check-in e check-out no mesmo quadro",
      texto: [
        "Os dois rituais acontecem no mesmo quadro. O selo na barra azul mostra a fase: \"CHECK-IN\" enquanto nenhuma equipe iniciou, \"CHECK-OUT\" a partir da primeira equipe que toca \"Iniciar turno\" (ou do primeiro lançamento). Não há botões para trocar de visão nem para editar.",
        "No check-in, o quadro mostra o que cada equipe vai fazer, a quantidade planejada e o efetivo. Atividade fora da programação aparece com o selo \"EXTRA\".",
        "No check-out: realizado sobre planejado, barra de cor, a causa e a observação quando há, e por equipe \"x de y programadas\", pessoas e HH.",
        "No check-out, as equipes que mais precisam de ajuda vêm primeiro: quem está com parada em aberto e, depois, quem tem o menor percentual concluído. A causa aparece em letra maior: \"Causa externa\" (fora do controle da equipe) em marrom e \"Causa interna\" em vermelho. Quem passou da meta ganha o selo \"▲ acima da meta\".",
        "Empréstimo de efetivo aparece dos dois lados: \"+2 Mecânico (de Fernando…)\" em quem recebeu e \"−2 Mecânico (para Francisco…)\" em quem cedeu. No cabeçalho, \"Atualizado HH:MM\" mostra a hora da última atualização.",
        "Quando uma equipe para \"Aguardando outra equipe\", o cartão dela mostra \"⏳ Aguardando Carlos\" (em vermelho) e o cartão do Carlos mostra \"João aguarda esta equipe\". A equipe aguardada sobe para o alto do quadro, junto com quem está parado.",
      ],
    },
    {
      id: "clima",
      titulo: "Resumo do clima",
      texto: [
        "Logo abaixo do cabeçalho, o quadro mostra o clima pela cidade da obra: a condição (sol, nuvens, chuva), a máxima e a mínima e a chuva.",
        "Antes do turno começar aparece a \"Previsão\" do horário do turno, útil para decidir o dia no check-in. Durante o turno, o \"Clima até agora\"; com o turno fechado, o clima registrado no RDO. Obra sem cidade cadastrada não mostra o clima.",
      ],
    },
    {
      id: "resumo-turno",
      titulo: "Vamos fechar o dia? O resumo do turno",
      texto: [
        "No check-out, o topo do quadro mostra o resumo do turno. O anel diz quantas atividades programadas já foram concluídas, com o farol: verde a partir de 80%, amarelo de 60% a 79% e vermelho abaixo de 60%. Ao lado, quantas estão concluídas, em andamento e não iniciadas.",
        "As barras comparam o \"Tempo do turno\" (quanto do horário previsto já passou) com o \"Avanço do dia\" (quanto as atividades andaram, em média). Se o avanço fica mais de 15 pontos atrás do tempo, aparece \"⚠ abaixo do ritmo\": é a hora de agir. Com o turno fechado, fica o \"Resultado final\".",
        "\"Aderência da obra\" soma todos os turnos fechados desde o início. O PPC dia a dia fica na Análise (PPC).",
      ],
      captura: {
        alt: "Resumo do turno com o anel de concluídas, as barras de tempo e avanço e a aderência da obra",
        alvo: { papel: "region", nome: "Resumo do turno" },
        dispositivo: "computador",
      },
    },
    {
      id: "problemas",
      titulo: "Problemas e oportunidades",
      texto: [
        "O quadro só exibe. Para cadastrar, abra a página do turno e, no fim dela, abra \"Problemas e oportunidades\" e use \"+ Problema ou oportunidade\": descreva, diga a ação, quem cuida (o app sugere os responsáveis da obra, mas pode ser qualquer nome) e o prazo.",
        "Os itens em aberto aparecem no quadro e na TV, com o prazo vencido em vermelho. Quando resolver, clique em \"Resolvido\": o item sai do quadro e fica riscado na lista, onde dá para \"Reabrir\".",
      ],
      captura: {
        alt: "Lista de problemas e oportunidades em aberto no quadro, com ação, responsável e prazo",
        alvo: { papel: "region", nome: "Problemas e oportunidades" },
        dispositivo: "computador",
      },
    },
    {
      id: "trocar-link",
      titulo: "Troque o link do quadro",
      texto: [
        "Se o link foi parar com quem não devia, clique em \"Gerar novo link\" na página da obra. O link antigo para de funcionar e mostra \"Link desativado. Peça o link novo ao planejador.\"",
      ],
    },
  ],
};
