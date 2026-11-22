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
        "Quando o campo termina (os responsáveis avisam por \"✓ Terminei minha parte\" ou o turno chega como enviado), abra o turno. Em \"Corrigir execução\" estão o executado de cada atividade, agrupado por responsável, e o efetivo de cada equipe.",
        "Corrija o que precisar: o número salva sozinho (\"Salvando…\" e depois \"Salvo ✓\").",
      ],
      captura: {
        alt: "Tela do turno em andamento com a correção da execução por responsável",
        alvo: { papel: "heading", nome: "Corrigir execução" },
        dispositivo: "computador",
      },
    },
    {
      id: "causas",
      titulo: "Informe as causas",
      texto: [
        "Toda atividade programada que não chegou à quantidade planejada precisa de uma \"Causa do não cumprimento\" (falta material, clima, aguardando outra equipe…). Toque em \"Não vai dar para concluir? Informar causa\" no cartão da atividade para abrir o campo. Com \"Outro\", escreva a observação.",
        "Serviço extra e atividade adiantada não pedem causa. Se faltar alguma causa, o app lista as atividades em \"Antes de fechar, informe a causa em:\"; toque em \"ir\" para chegar ao campo.",
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
        "Clique em \"Fechar turno\" e depois em \"Confirmar fechamento\". Se houver parada sem horário de fim, o app pergunta até que horas o pessoal ficou parado.",
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
        "Ao fechar, o RDO (Relatório Diário de Obra) é gerado em PDF. Clique em \"Baixar RDO (v1)\" no turno (o número muda a cada versão). Antes de fechar, \"Baixar prévia (rascunho)\" mostra como ele vai ficar.",
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
