import type { Capitulo } from "../tipos";

export const duvidas: Capitulo = {
  slug: "duvidas",
  titulo: "Dúvidas comuns",
  resumo: "Sinal fraco, mais de uma aba aberta, link desativado e atividades sem responsável.",
  noIndice: false,
  passos: [
    {
      id: "nao-salvo",
      titulo: "\"Não salvo\" e sinal fraco",
      texto: [
        "Cada número digitado salva sozinho. Enquanto grava aparece \"Salvando…\"; quando o servidor confirma, \"Salvo ✓\". Só confie no \"Salvo ✓\".",
        "Sem sinal, aparece \"Não salvo — sem sinal. Tentando de novo…\" e o aviso de quantos lançamentos ainda não foram salvos. O app guarda o que foi digitado enquanto a tela está aberta e reenvia quando a rede volta. Não feche nem atualize a tela até sumir o aviso; se quiser, toque em \"Tentar de novo\".",
      ],
    },
    {
      id: "conflito-abas",
      titulo: "Mais de uma aba aberta",
      texto: [
        "Se o mesmo número foi mudado em outra tela (outra aba sua, ou outra pessoa), o app não sobrescreve: avisa que mudou em outra tela e oferece \"Ver valor atual\". Confira e digite de novo se precisar; o app mostra o que você tinha digitado.",
      ],
    },
    {
      id: "link-desativado",
      titulo: "Link desativado",
      texto: [
        "Link de campo antigo mostra \"Link inválido ou substituído. Peça um novo link ao planejador.\" Isso acontece quando alguém clicou em \"Gerar novo link\" no turno. Mande o link atual, que continua visível na tela do turno.",
        "O mesmo vale para o quadro da TV: depois de \"Gerar novo link\" na página da obra, o antigo mostra \"Link desativado\".",
      ],
    },
    {
      id: "sem-responsavel",
      titulo: "Atividade sem responsável",
      texto: [
        "Atividade sem responsável fica no grupo \"Sem responsável\", no fim da lista, e só aparece no link de campo em \"Ver tudo\". Escolha um responsável no menu \"Responsável\" da atividade para que ela apareça para a pessoa certa.",
      ],
    },
  ],
};
