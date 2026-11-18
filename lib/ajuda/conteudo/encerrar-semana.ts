import type { Capitulo } from "../tipos";

export const encerrarSemana: Capitulo = {
  slug: "encerrar-semana",
  titulo: "Encerrar a semana e ler o PPC",
  resumo: "Encerre a semana com as causas do que não foi cumprido e acompanhe o PPC na Análise.",
  noIndice: false,
  passos: [
    { id: "encerrar", titulo: "Encerre a semana", texto: [] },
    { id: "analise", titulo: "Leia a Análise (PPC)", texto: [] },
  ],
};
