import type { Capitulo } from "../tipos";

export const checkIn: Capitulo = {
  slug: "check-in",
  titulo: "Abrir o turno e fazer o check-in",
  resumo: "Abra o turno do dia, confira quem faz o quê e o efetivo, e libere o link para o campo.",
  noIndice: false,
  passos: [
    { id: "novo-turno", titulo: "Abra o turno", texto: [] },
    { id: "trazer-programacao", titulo: "Traga as atividades da programação", texto: [] },
    { id: "adicionar-atividade", titulo: "Adicione uma atividade", texto: [] },
    { id: "efetivo", titulo: "Faça o check-in: confira equipes e efetivo", texto: [] },
    { id: "liberar", titulo: "Libere o turno ao campo", texto: [] },
    { id: "enviar-link", titulo: "Envie o link aos responsáveis", texto: [] },
  ],
};
