import type { Capitulo } from "../tipos";

export const programarSemana: Capitulo = {
  slug: "programar-semana",
  titulo: "Programar a semana",
  resumo: "Monte a programação da semana com meta, dias, equipe prevista e responsável de cada atividade.",
  noIndice: false,
  passos: [
    {
      id: "abrir-programacao",
      titulo: "Abra a programação da semana",
      texto: [
        "No menu lateral, clique em \"Programação\". A lista mostra as semanas da obra, da mais recente para a mais antiga, com a situação de cada uma (Rascunho, Programada, Aguardando encerramento ou Encerrada) e o PPC.",
        "Enquanto a semana atual não tem programação (obra nova), o botão em destaque é \"Programar esta semana\"; depois, passa a ser \"Programar próxima semana\". Para outra semana, escolha uma data em \"Data da semana\" e clique em \"Abrir semana\": o app usa a segunda-feira daquela semana.",
      ],
      captura: {
        alt: "Lista de semanas da programação com os botões para abrir uma semana",
        alvo: { papel: "button", nome: "Abrir semana" },
        dispositivo: "computador",
      },
    },
    {
      id: "adicionar-atividade",
      titulo: "Adicione as atividades",
      texto: [
        "A semana começa como rascunho. Em \"Nova atividade\", preencha a \"Descrição\", o \"Local (opcional)\", a \"Unidade\" e a \"Meta da semana\" (quanto deve ficar pronto até domingo).",
        "Marque os \"Dias\" em que a atividade vai ser feita e o \"Período\" (Diurno ou Noturno). O app divide a meta pelos dias e mostra a sugestão diária. Meta inteira (peças, tubos, un) é dividida em números inteiros, sem \"0,5 un\": o último dia fica com o que sobrar.",
        "Em \"Equipe prevista\", informe as funções e quantas pessoas de cada (\"Adicionar função\" para mais linhas). Escolha o \"Responsável\" pela atividade e clique em \"Adicionar atividade\".",
        "Depois de adicionar, o formulário limpa só a \"Descrição\" e a \"Meta da semana\": local, unidade, dias, período, responsável e equipe continuam preenchidos para a próxima atividade. Para repetir uma atividade parecida (ex.: a mesma no turno da noite), clique em \"Duplicar\" nela e troque só o que muda.",
      ],
      dica: "Atividade sem responsável não trava nada, mas o app avisa. Com responsável, cada um vê só a sua parte no link de campo.",
      captura: {
        alt: "Formulário de nova atividade da semana com meta, dias, período e equipe prevista",
        alvo: { papel: "button", nome: "Adicionar atividade" },
        dispositivo: "computador",
      },
    },
    {
      id: "programar",
      titulo: "Programe a semana",
      texto: [
        "Confira a lista em \"Atividades da semana\" (\"Editar\" ou \"Apagar\" em cada uma) e clique em \"Programar semana\". O app pede confirmação, porque depois disso a lista, as metas e a equipe ficam travadas.",
        "A partir daí a semana fica Programada: cada turno novo daquela semana já vem com as atividades do dia e a quantidade sugerida.",
      ],
      captura: {
        alt: "Rascunho da semana com a lista de atividades e o botão Programar semana",
        alvo: { papel: "button", nome: "Programar semana" },
        dispositivo: "computador",
      },
    },
    {
      id: "acompanhar",
      titulo: "Acompanhe a semana",
      texto: [
        "Com a semana programada, a mesma tela mostra o PPC da semana (provisório até encerrar) e, por atividade, a meta, o realizado, o saldo e a situação: Cumprida, Em andamento ou Sem execução.",
        "Também aparecem as atividades \"Fora da programação (extra)\" lançadas nos turnos e o quadro \"Efetivo previsto × real\" por dia, período e função.",
      ],
      captura: {
        alt: "Semana programada com PPC provisório, atividades e efetivo previsto × real",
        alvo: { papel: "heading", nome: "Efetivo previsto × real" },
        dispositivo: "computador",
      },
    },
    {
      id: "reabrir",
      titulo: "Reabra a programação",
      texto: [
        "Precisa mudar algo numa semana já programada? Clique em \"Reabrir programação\", informe o motivo e confirme. Edite as atividades e clique em \"Programar semana\" de novo.",
        "O que já foi lançado nos turnos continua ligado às atividades.",
      ],
    },
  ],
};
