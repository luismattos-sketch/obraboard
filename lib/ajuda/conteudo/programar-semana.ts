import type { Capitulo } from "../tipos";

export const programarSemana: Capitulo = {
  slug: "programar-semana",
  titulo: "Programar a semana",
  resumo: "Monte a programação da semana com meta, dias, equipe prevista e responsável de cada atividade.",
  noIndice: false,
  passos: [
    { id: "abrir-programacao", titulo: "Abra a programação da semana", texto: [] },
    { id: "adicionar-atividade", titulo: "Adicione as atividades", texto: [] },
    { id: "programar", titulo: "Programe a semana", texto: [] },
    { id: "acompanhar", titulo: "Acompanhe a semana", texto: [] },
    { id: "reabrir", titulo: "Reabra a programação", texto: [] },
  ],
};
