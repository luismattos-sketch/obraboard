import type { Capitulo } from "../tipos";

export const quadroTv: Capitulo = {
  slug: "quadro-tv",
  titulo: "Quadro na TV",
  resumo: "Deixe o quadro do turno numa TV do canteiro, sem login, e troque o link quando precisar.",
  noIndice: false,
  passos: [
    {
      id: "link",
      titulo: "Abra o quadro na TV",
      texto: [
        "Na página da obra, em \"Link do quadro (TV / gestor)\", use \"Copiar\" e abra o link no navegador da TV ou do computador ligado a ela. Não precisa de login.",
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
      titulo: "Check-in e check-out no quadro",
      texto: [
        "Antes de liberar o turno, o quadro mostra o check-in: o que cada equipe vai fazer, a quantidade planejada e o efetivo. Atividade fora da programação aparece com o selo \"EXTRA\".",
        "Depois de liberar, mostra o check-out: realizado sobre planejado, barra de cor, a causa quando há, e por equipe \"x de y programadas\", pessoas e HH. Use os links \"Check-in\" e \"Check-out\", abaixo do cabeçalho, para trocar de visão.",
      ],
    },
    {
      id: "ppc-mes",
      titulo: "PPC do mês e farol",
      texto: [
        "No fim do quadro, \"PPC do mês\" tem uma barra por dia do mês do turno mostrado: a parte das atividades programadas que foi concluída naquele dia. Só contam turnos fechados; serviço extra e atividade adiantada não entram.",
        "A cor é o farol: verde a partir de 80%, amarelo de 60% a 79% e vermelho abaixo de 60%. Ao lado do título, \"Aderência do mês\" soma o mês inteiro até agora, com o farol dela.",
      ],
      captura: {
        alt: "Bloco PPC do mês com uma barra colorida por dia e a aderência do mês",
        alvo: { papel: "region", nome: "PPC do mês" },
        dispositivo: "computador",
      },
    },
    {
      id: "problemas",
      titulo: "Problemas e oportunidades",
      texto: [
        "Na página do quadro do planejador, abaixo do quadro, abra \"Problemas e oportunidades\" e use \"+ Problema ou oportunidade\": descreva, diga a ação, quem cuida (o app sugere os responsáveis da obra, mas pode ser qualquer nome) e o prazo.",
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
