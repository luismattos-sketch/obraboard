import type { Capitulo } from "../tipos";

export const checkIn: Capitulo = {
  slug: "check-in",
  titulo: "Abrir o turno e fazer o check-in",
  resumo: "Abra o turno do dia, confira e confirme quem faz o quê e com que equipe, e libere o link para o campo.",
  noIndice: false,
  passos: [
    {
      id: "novo-turno",
      titulo: "Abra o turno",
      texto: [
        "Na etapa \"Turnos\" da obra, clique em \"Novo turno\". Escolha a \"Data\" e o \"Período\" (Diurno ou Noturno) e clique em \"Criar turno\".",
        "Se a semana estiver programada, o turno já vem com as atividades marcadas para aquele dia e período, com a quantidade sugerida e o selo \"Programada\".",
      ],
      captura: {
        alt: "Formulário de novo turno com data e período",
        alvo: { papel: "button", nome: "Criar turno" },
        dispositivo: "computador",
      },
    },
    {
      id: "trazer-programacao",
      titulo: "Traga as atividades da programação",
      texto: [
        "Programou a semana depois de criar o turno, ou mudou a programação? Clique em \"Trazer da programação\" para incluir as atividades do dia que ainda não estão no turno. Pode clicar mais de uma vez: nada é duplicado.",
      ],
    },
    {
      id: "adicionar-atividade",
      titulo: "Adicione uma atividade",
      texto: [
        "Para uma atividade que não está na programação, use \"Adicionar atividade\": \"Descrição\", \"Local (opcional)\", \"Quantidade\" planejada e \"Unidade\". Escolha o \"Responsável\" (obrigatório) e, se quiser, a \"Equipe prevista\" (função e quantidade).",
        "Numa semana programada, atividade adicionada à mão aparece com o selo \"Avulsa\" e não entra no PPC.",
      ],
    },
    {
      id: "efetivo",
      titulo: "Faça o check-in: confirme cada atividade",
      texto: [
        "O check-in é o combinado do turno: quais atividades cada responsável vai fazer e com quantas pessoas. As atividades aparecem agrupadas por responsável; troque no menu \"Responsável\" de cada uma se precisar.",
        "Precisa mudar a equipe de uma atividade? Clique em \"Editar\": além da descrição e da quantidade, dá para ajustar a \"Equipe\" (função e quantidade de pessoas) e clicar em \"Salvar\".",
        "Com tudo certo, clique em \"Confirmar\", ao lado de \"Remover\". A atividade ganha o selo \"Confirmada\" e a equipe dela entra no efetivo do responsável: duas atividades do mesmo responsável somam as pessoas. Se editar uma atividade já confirmada, confirme de novo.",
        "O efetivo conta o horário do turno descontando o \"Intervalo de refeição\" para calcular os homens-hora (HH).",
        "Cada equipe conta HH do seu \"Iniciar turno\" até o seu \"Terminei minha parte\". Equipe que não tocou um deles usa o início ou o fim do turno. Gente emprestada conta pelo horário da equipe que recebeu.",
      ],
      captura: {
        alt: "Turno planejado com atividades agrupadas por responsável, o selo Confirmada e o botão Confirmar",
        alvo: { papel: "button", nome: "Confirmar" },
        dispositivo: "computador",
      },
    },
    {
      id: "liberar",
      titulo: "Libere o turno ao campo",
      texto: [
        "Com tudo conferido, clique em \"Liberar para campo\". O quadro continua em \"CHECK-IN\" até a primeira equipe iniciar.",
        "Use \"Ver quadro\" para abrir o quadro do turno, o mesmo da TV.",
      ],
      captura: {
        alt: "Turno pronto para liberar, com o botão Liberar para campo",
        alvo: { papel: "button", nome: "Liberar para campo" },
        dispositivo: "computador",
      },
    },
    {
      id: "enviar-link",
      titulo: "Envie o link aos responsáveis",
      texto: [
        "Depois de liberar, aparece o \"Link de campo\". Clique em \"Copiar link\" ou em \"Enviar pelo WhatsApp\" e mande aos responsáveis. É o mesmo link para todos: cada um escolhe o próprio nome ao abrir.",
        "O link continua visível na tela do turno. \"Gerar novo link\" faz o link anterior parar de funcionar, por isso o app pede confirmação.",
      ],
      captura: {
        alt: "Bloco do link de campo com os botões de copiar e enviar pelo WhatsApp",
        alvo: { papel: "button", nome: "Copiar link" },
        dispositivo: "computador",
      },
    },
  ],
};
