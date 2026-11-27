import type { Capitulo } from "../tipos";

export const fecharTurno: Capitulo = {
  slug: "fechar-turno",
  titulo: "Fechar o turno e gerar o RDO",
  resumo: "Confira o que foi feito, informe as causas, feche o turno e baixe o RDO.",
  noIndice: false,
  passos: [
    {
      id: "check-out",
      titulo: "Confira a execução (check-out)",
      texto: [
        "Quando o campo termina (os responsáveis avisam por \"✓ Terminei minha parte\" ou o turno chega como enviado), abra o turno. No alto ficam as paradas, \"O que falta\" e o resumo. Toque em \"Corrigir execução\" para abrir a seção com o executado de cada atividade, agrupado por responsável, e o efetivo de cada equipe.",
        "Corrija o que precisar: o número salva sozinho (\"Salvando…\" e depois \"Salvo ✓\"). Cada atividade e cada equipe mostra quem alterou por último (\"Última alteração: Ana · 09:12\").",
        "O horário real sai sozinho do campo: o início é o do primeiro responsável que tocou em \"Iniciar turno\", e o fim, o do último que tocou em \"Terminei minha parte\". Se precisar, corrija aqui. O início corrigido só muda se um responsável tocar em \"Iniciar turno\" (ou desfizer); o fim, quando todos terminarem ou alguém desfizer o \"Terminei\".",
      ],
      captura: {
        alt: "Tela do turno em andamento com a correção da execução por responsável",
        alvo: { papel: "region", nome: "Corrigir execução" },
        dispositivo: "computador",
      },
    },
    {
      id: "clima",
      titulo: "Confira o clima",
      texto: [
        "O clima é registrado sozinho, pela cidade da obra, quando o turno é enviado ou fechado: temperatura média, máxima e mínima, se choveu e as leituras de 2 em 2 horas durante o turno. Ele sai assim no RDO (dados: Open-Meteo).",
        "Se o serviço de clima estiver fora do ar no envio, aparece \"Buscar clima de novo\". A obra não tem cidade? Informe em \"Cidade da obra\", na página da obra.",
        "Parada por chuva se marca na atividade, com a causa \"Clima\" (externa). O RDO mostra quantas atividades pararam por clima.",
      ],
    },
    {
      id: "causas",
      titulo: "Informe as causas",
      texto: [
        "Toda atividade programada que não chegou à quantidade planejada precisa de uma \"Causa do não cumprimento\" (falta material, clima, aguardando outra equipe…). Toque em \"Não vai dar para concluir? Informar causa\" no cartão da atividade para abrir o campo. Com \"Outro\", escreva a observação.",
        "Serviço extra e atividade adiantada não pedem causa. Se faltar alguma causa, ao tocar em \"Fechar turno\" o app lista as atividades no alto da página, em \"Antes de fechar, informe a causa em:\"; toque em \"ir\" para abrir \"Corrigir execução\" direto no campo.",
      ],
      captura: {
        alt: "Atividade parcial com o campo Causa do não cumprimento",
        alvo: { papel: "combobox", nome: "Causa do não cumprimento" },
        dispositivo: "computador",
      },
    },
    {
      id: "fechar",
      titulo: "Feche o turno",
      texto: [
        "O botão \"Fechar turno\" fica no alto da página, ao lado de \"Ver quadro\". Clique nele e depois em \"Confirmar fechamento\". Se houver parada sem horário de fim, o app pergunta até que horas o pessoal ficou parado.",
        "Fechado, o turno não aceita mais lançamentos pelo link, e o campo vê \"Turno fechado pelo planejador\".",
      ],
      captura: {
        alt: "Botão Fechar turno na tela do turno",
        alvo: { papel: "button", nome: "Fechar turno" },
        dispositivo: "computador",
      },
    },
    {
      id: "rdo",
      titulo: "Baixe o RDO",
      texto: [
        "Ao fechar, o RDO (Relatório Diário de Obra) é gerado em PDF. Clique em \"Baixar RDO (v1)\" no turno (o número muda a cada versão). Antes de fechar, abra a seção \"RDO\": \"Baixar prévia (rascunho)\" mostra como ele vai ficar.",
        "No RDO, as atividades e o efetivo aparecem separados por responsável. Serviço extra e atividade adiantada vêm marcados em negrito (EXTRA, ADIANTADA), e a coluna de causa e observação é larga para o texto caber.",
        "Na etapa \"RDOs\" ficam todos os RDOs da obra; em \"RDOs de todas as obras\", no menu lateral, dá para filtrar e baixar vários de uma vez.",
      ],
      captura: {
        alt: "Turno fechado com o botão de baixar o RDO",
        alvo: { papel: "link", nome: "Baixar RDO (v1)" },
        dispositivo: "computador",
      },
    },
    {
      id: "reabrir",
      titulo: "Reabra um turno fechado",
      texto: [
        "Achou um erro depois de fechar? Clique em \"Reabrir turno\", escreva o \"Motivo da reabertura\" e clique em \"Confirmar reabertura\". Corrija e feche de novo.",
        "Cada fechamento gera uma nova versão do RDO (v1, v2…). As anteriores continuam disponíveis em \"Versões anteriores\".",
      ],
    },
  ],
};
