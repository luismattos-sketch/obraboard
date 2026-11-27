import type { Capitulo } from "../tipos";

export const duranteOTurno: Capitulo = {
  slug: "durante-o-turno",
  titulo: "Acompanhar o turno",
  resumo: "Veja o andamento no quadro, as paradas avisadas pelo campo e lance serviço extra ou atividade adiantada.",
  noIndice: false,
  passos: [
    {
      id: "quadro",
      titulo: "Acompanhe pelo quadro",
      texto: [
        "Enquanto o campo lança, abra \"Quadro\" na página da obra (ou \"Ver quadro\" no turno): é o mesmo quadro da TV, pelo link, sem login. Cada responsável tem uma faixa com o efetivo e as atividades, com barra verde (concluída), amarela (parcial) ou vermelha (não iniciada).",
        "O quadro se atualiza sozinho a cada 30 segundos.",
      ],
      captura: {
        alt: "Quadro do turno com uma faixa por responsável e o andamento das atividades",
        alvo: { papel: "link", nome: "Agora" },
        dispositivo: "computador",
      },
    },
    {
      id: "paradas",
      titulo: "Veja as paradas avisadas",
      texto: [
        "Quando o campo avisa uma parada, ela aparece em destaque no topo da tela do turno (⚠): quem, quantas pessoas, desde que horas, a causa (por exemplo, aguardando outra equipe) e a foto, se houver.",
        "Quando o pessoal volta, o responsável marca \"Voltamos a trabalhar\". Você também pode marcar pelo turno. Parada sem fim no fechamento pede o horário em que terminou.",
        "Para registrar uma parada você mesmo, use \"⚠ Parada\" no efetivo da equipe. Ali também ficam \"+ Emprestar\" (pessoas que foram ajudar outra equipe) e \"+ Saída antes\".",
      ],
      captura: {
        alt: "Faixa de paradas do turno com a causa, as pessoas paradas e o horário",
        alvo: { papel: "region", nome: "Paradas do turno" },
        dispositivo: "computador",
      },
    },
    {
      id: "o-que-falta",
      titulo: "Veja o que falta e cobre o responsável",
      texto: [
        "No alto da tela do turno, \"O que falta\" mostra, por responsável, o que ainda não foi registrado: atividade sem lançamento, texto contado à IA que não foi lançado e, depois do fim do turno (ou quando a equipe toca \"Terminei minha parte\"), causa não informada e o \"Terminei\" que faltou.",
        "Enquanto o turno está em andamento, o grupo aparece como \"em andamento\": é normal ainda faltar. Depois do fim, fica em destaque. Toque em \"ir\" para ir direto à atividade.",
        "\"Cobrar no WhatsApp\" abre a conversa com o responsável e uma mensagem pronta com o que falta e o link de campo dele. Para abrir direto no número, cadastre o telefone em Responsáveis da obra.",
      ],
      captura: {
        alt: "Bloco O que falta no turno, com as pendências por responsável e o botão Cobrar no WhatsApp",
        alvo: { papel: "region", nome: "O que falta" },
        dispositivo: "computador",
      },
    },
    {
      id: "servico-extra",
      titulo: "Lance um serviço extra",
      texto: [
        "Serviço feito fora da programação? Abra \"Corrigir execução\" e clique em \"+ Serviço extra (fora da programação)\", preencha \"Descrição\", \"Quantidade feita\", \"Unidade\" e \"Responsável\" e clique em \"Lançar serviço extra\". Em \"Quem do cliente pediu\", anote o nome e a função de quem solicitou: fica no card da atividade e no RDO, como registro para a medição. Aponte também o \"HH no serviço extra\" (pessoas × horas) e o \"Material usado\" (item, quantidade e unidade): o RDO mostra o \"HH em serviço extra\" separado do HH do turno, e cada extra traz o seu HH e o material na coluna de observação.",
        "O extra entra no RDO com o selo \"EXTRA\", não tem meta e não pede causa.",
      ],
      captura: {
        alt: "Formulário de serviço extra no turno",
        alvo: { papel: "button", nome: "+ Serviço extra (fora da programação)" },
        dispositivo: "computador",
      },
    },
    {
      id: "adiantar",
      titulo: "Adiante uma atividade",
      texto: [
        "Sobrou tempo e dá para começar algo previsto para outro dia da semana? Clique em \"+ Adiantar atividade da semana\" e toque na atividade: ela vem para hoje com o saldo que falta.",
        "Atividade de um dia anterior que não terminou? Use \"Continuar atividade atrasada\".",
        "Adiantada não pede causa se não terminar. Enquanto o turno não fecha, dá para remover a atividade puxada.",
      ],
    },
  ],
};
