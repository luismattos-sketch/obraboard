import type { Capitulo } from "../tipos";

export const duvidas: Capitulo = {
  slug: "duvidas",
  titulo: "Dúvidas comuns",
  resumo: "Sinal fraco, mais de uma aba aberta, link desativado e atividades sem responsável.",
  noIndice: false,
  passos: [
    { id: "nao-salvo", titulo: "\"Não salvo\" e sinal fraco", texto: [] },
    { id: "conflito-abas", titulo: "Mais de uma aba aberta", texto: [] },
    { id: "link-desativado", titulo: "Link desativado", texto: [] },
    { id: "sem-responsavel", titulo: "Atividade sem responsável", texto: [] },
  ],
};
