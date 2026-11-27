import type { Capitulo } from "../tipos";

export const encerrarSemana: Capitulo = {
  slug: "encerrar-semana",
  titulo: "Encerrar a semana e ler o PPC",
  resumo: "Encerre a semana com as causas do que não foi cumprido e acompanhe o PPC na Análise.",
  noIndice: false,
  passos: [
    {
      id: "encerrar",
      titulo: "Encerre a semana",
      texto: [
        "A partir do último dia com atividade programada, a tela da semana mostra o quadro \"Encerrar semana\". Depois do domingo, a lista de semanas marca a semana como Aguardando encerramento.",
        "O quadro lista as atividades programadas que não foram cumpridas, cada uma com a causa sugerida pelo último turno. Confira ou troque a causa e clique em \"Encerrar semana\".",
        "Encerrada, a semana fica só para leitura e o PPC deixa de ser provisório. Se precisar corrigir, use \"Reabrir\" e informe o motivo.",
      ],
      captura: {
        alt: "Encerramento da semana com a causa de cada atividade não cumprida",
        alvo: { papel: "button", nome: "Encerrar semana" },
        dispositivo: "computador",
      },
    },
    {
      id: "analise",
      titulo: "Leia a Análise (PPC)",
      texto: [
        "PPC é o Percentual de Planejamento Concluído: das atividades programadas, quantas foram cumpridas. Uma semana com 10 atividades programadas e 7 cumpridas tem PPC de 70%.",
        "Na etapa \"Análise (PPC)\", escolha o período (4, 8 ou 12 semanas). Veja o \"PPC do período\", o \"PPC por semana\" e as \"Causas de não cumprimento\", que mostram o que mais atrapalhou. No fim, \"HH perdido em paradas\" soma as horas de gente parada nos turnos fechados do período: por grupo (externas, fora do controle da equipe, × internas), por causa e por responsável — toque no nome para ver as causas daquela equipe. A lista começa na semana em que a obra começou, e o selo \"provisório\" avisa que ainda há semana em andamento.",
        "As causas vêm separadas em \"Externas\" (fora do controle da equipe, como material ou liberação de área), \"Internas\" (mão de obra e equipamento) e \"Outras\".",
        "Use as causas para programar melhor a semana seguinte: se \"Falta material\" se repete, por exemplo, confirme o material antes de programar.",
      ],
      captura: {
        alt: "Tela de análise com o PPC por semana e as causas de não cumprimento",
        alvo: { papel: "heading", nome: "PPC por semana" },
        dispositivo: "computador",
      },
    },
    {
      id: "numeros-diferentes",
      titulo: "Por que os números mudam de uma tela para outra",
      texto: [
        "\"Cumprimento do dia\" (no turno e no RDO) conta a atividade que chegou à meta do dia. \"PPC da semana\" (na programação) conta a atividade que cumpriu a meta da semana inteira. Por isso o mesmo dia pode mostrar 63% no turno e 0% na semana: a atividade cumpriu o dia, mas a semana ainda não acabou.",
        "Atividade que andou só uma parte não conta como cumprida. Ela aparece no \"avanço físico\", ao lado: 45 de 90 m³ é 50% de avanço físico, mesmo com cumprimento 0%.",
        "Serviço extra e atividade adiantada ficam fora das duas contas.",
      ],
    },
    {
      id: "ppc-dia-a-dia",
      titulo: "PPC dia a dia",
      texto: [
        "Abaixo do \"PPC por semana\", \"PPC dia a dia\" tem uma barra por dia do período escolhido: a parte das atividades do dia que foi concluída. Só contam turnos fechados; serviço extra e atividade adiantada não entram.",
        "A cor é o farol: verde a partir de 80%, amarelo de 60% a 79% e vermelho abaixo de 60%. Passe o mouse (ou toque) numa barra para ver o dia e a conta.",
      ],
      captura: {
        alt: "Gráfico PPC dia a dia com uma barra colorida por dia do período",
        alvo: { papel: "heading", nome: "PPC dia a dia" },
        dispositivo: "computador",
      },
    },
  ],
};
